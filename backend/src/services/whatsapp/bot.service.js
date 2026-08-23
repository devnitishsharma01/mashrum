"use strict";

const { docToObject, toId } = require("../../db");
const {
  ConversationSession,
  Category,
  Product,
  ProductVariant,
  Inventory,
  CustomerAddress,
  User,
  Notification,
  Business,
} = require("../../models");
const { isBusinessOpen } = require("../../shared");
const { toNumber } = require("../../lib/money");
const { getOrCreateActiveCart, addToCart, formatCartText, clearCart, markCartConverted } =
  require("../cart.service");
const { createOrder } = require("../order.service");
const { upsertCustomerByWaId } = require("../customer.service");
const { sendTextToCustomer, renderTemplate } = require("./messaging.service");

async function getSession(businessId, customerId) {
  const session = await ConversationSession.findOneAndUpdate(
    { businessId: toId(businessId), customerId: toId(customerId) },
    {
      $setOnInsert: {
        businessId: toId(businessId),
        customerId: toId(customerId),
        state: "IDLE",
        context: {},
      },
    },
    { upsert: true, new: true },
  );
  return docToObject(session);
}

async function setSession(businessId, customerId, state, context = {}) {
  const session = await ConversationSession.findOneAndUpdate(
    { businessId: toId(businessId), customerId: toId(customerId) },
    {
      businessId: toId(businessId),
      customerId: toId(customerId),
      state,
      context,
    },
    { upsert: true, new: true },
  );
  return docToObject(session);
}

async function reply(businessId, customerId, waId, body) {
  await sendTextToCustomer({ businessId, customerId, toWaId: waId, body });
}

function normalize(text) {
  return text.trim().toLowerCase();
}

async function listVisibleCategories(businessId) {
  const categories = await Category.find({
    businessId: toId(businessId),
    isVisible: true,
  })
    .sort({ sortOrder: 1, name: 1 })
    .lean();

  return categories.map((c) => ({
    id: c._id.toString(),
    name: c.name,
    slug: c.slug,
    sortOrder: c.sortOrder,
    isVisible: c.isVisible,
  }));
}

async function listVisibleProducts(businessId, categoryId) {
  const query = {
    businessId: toId(businessId),
    isVisible: true,
    isAvailable: true,
  };
  if (categoryId) query.categoryId = toId(categoryId);

  const products = await Product.find(query).sort({ name: 1 }).limit(20).lean();
  if (products.length === 0) return [];

  const productIds = products.map((p) => p._id);
  const [variants, inventory] = await Promise.all([
    ProductVariant.find({
      businessId: toId(businessId),
      productId: { $in: productIds },
      isAvailable: true,
    })
      .sort({ createdAt: 1 })
      .lean(),
    Inventory.find({
      businessId: toId(businessId),
      productId: { $in: productIds },
      variantId: null,
    }).lean(),
  ]);

  const variantMap = new Map();
  for (const row of variants) {
    const pid = row.productId.toString();
    if (!variantMap.has(pid)) variantMap.set(pid, []);
    variantMap.get(pid).push({
      id: row._id.toString(),
      name: row.name,
      price: row.price,
    });
  }

  const inventoryMap = new Map(
    inventory.map((r) => [r.productId.toString(), [{ quantityOnHand: r.quantityOnHand }]]),
  );

  return products.map((p) => ({
    id: p._id.toString(),
    name: p.name,
    basePrice: p.basePrice,
    variants: variantMap.get(p._id.toString()) ?? [],
    inventory: inventoryMap.get(p._id.toString()) ?? [],
  }));
}

function helpText(businessName) {
  return [
    `*${businessName}* WhatsApp ordering`,
    "",
    "Commands:",
    "*menu* - browse categories",
    "*cart* - view cart",
    "*checkout* - place order",
    "*cancel* - reset conversation",
  ].join("\n");
}

async function showCategories(deps, customerId) {
  const categories = await listVisibleCategories(deps.businessId);
  if (categories.length === 0) {
    const products = await listVisibleProducts(deps.businessId);
    if (products.length === 0) {
      await reply(
        deps.businessId,
        customerId,
        deps.waId,
        "No products are available right now. Please try again later.",
      );
      await setSession(deps.businessId, customerId, "IDLE");
      return;
    }

    const lines = products.map(
      (p, i) => `${i + 1}. ${p.name} - ${deps.currency} ${toNumber(p.basePrice).toFixed(2)}`,
    );
    await setSession(deps.businessId, customerId, "BROWSING_PRODUCTS", {
      products: products.map((p) => p.id),
    });
    await reply(
      deps.businessId,
      customerId,
      deps.waId,
      ["*Products*", ...lines, "", "Reply with a number to select."].join("\n"),
    );
    return;
  }

  const lines = categories.map((c, i) => `${i + 1}. ${c.name}`);
  await setSession(deps.businessId, customerId, "BROWSING_CATEGORIES", {
    products: categories.map((c) => c.id),
  });
  await reply(
    deps.businessId,
    customerId,
    deps.waId,
    ["*Categories*", ...lines, "", "Reply with a number to open a category."].join("\n"),
  );
}

async function handleInboundText(deps) {
  const customer = await upsertCustomerByWaId(deps.businessId, deps.waId, deps.contactName);
  const session = await getSession(deps.businessId, customer.id);
  const context = session.context || {};
  const text = normalize(deps.text);
  const state = session.state;

  const businessDoc = await Business.findById(toId(deps.businessId))
    .select("workingHours timezone")
    .lean();
  if (businessDoc) {
    const open = isBusinessOpen(businessDoc.workingHours, businessDoc.timezone);
    if (!open.open) {
      if (text === "cancel") {
        await setSession(deps.businessId, customer.id, "IDLE", {});
      }
      await reply(
        deps.businessId,
        customer.id,
        deps.waId,
        open.reason || "We are currently closed.",
      );
      return;
    }
  }

  if (["hi", "hello", "start", "help"].includes(text)) {
    const welcome =
      (await renderTemplate(deps.businessId, "WELCOME", {
        business_name: deps.businessName,
      })) || helpText(deps.businessName);
    await reply(deps.businessId, customer.id, deps.waId, welcome);
    await showCategories(deps, customer.id);
    return;
  }

  if (text === "menu") {
    await showCategories(deps, customer.id);
    return;
  }

  if (text === "cancel") {
    await setSession(deps.businessId, customer.id, "IDLE", {});
    await reply(
      deps.businessId,
      customer.id,
      deps.waId,
      "Conversation reset. Reply *menu* to browse again.",
    );
    return;
  }

  if (text === "cart") {
    const cart = await getOrCreateActiveCart(deps.businessId, customer.id);
    await setSession(deps.businessId, customer.id, "CART_REVIEW", context);
    await reply(deps.businessId, customer.id, deps.waId, formatCartText(cart, deps.currency));
    return;
  }

  if (text === "checkout") {
    const cart = await getOrCreateActiveCart(deps.businessId, customer.id);
    if (cart.items.length === 0) {
      await reply(
        deps.businessId,
        customer.id,
        deps.waId,
        "Your cart is empty. Reply *menu* to add products.",
      );
      return;
    }
    await setSession(deps.businessId, customer.id, "AWAITING_ADDRESS", {});
    await reply(
      deps.businessId,
      customer.id,
      deps.waId,
      "Please send your delivery address in one message.\nExample: House 12, Sector 5, Ghaziabad",
    );
    return;
  }

  if (state === "BROWSING_CATEGORIES") {
    const index = Number(text) - 1;
    const categoryIds = context.products || [];
    const categoryId = categoryIds[index];
    if (!categoryId) {
      await reply(
        deps.businessId,
        customer.id,
        deps.waId,
        "Invalid option. Reply with a category number, or *menu*.",
      );
      return;
    }

    const products = await listVisibleProducts(deps.businessId, categoryId);
    if (products.length === 0) {
      await reply(deps.businessId, customer.id, deps.waId, "No products in this category. Reply *menu*.");
      return;
    }

    const lines = products.map(
      (p, i) => `${i + 1}. ${p.name} - ${deps.currency} ${toNumber(p.basePrice).toFixed(2)}`,
    );
    await setSession(deps.businessId, customer.id, "BROWSING_PRODUCTS", {
      categoryId,
      products: products.map((p) => p.id),
    });
    await reply(
      deps.businessId,
      customer.id,
      deps.waId,
      ["*Products*", ...lines, "", "Reply with a number to select."].join("\n"),
    );
    return;
  }

  if (state === "BROWSING_PRODUCTS") {
    const index = Number(text) - 1;
    const productIds = context.products || [];
    const productId = productIds[index];
    if (!productId) {
      await reply(
        deps.businessId,
        customer.id,
        deps.waId,
        "Invalid option. Reply with a product number, or *menu*.",
      );
      return;
    }

    const productDoc = await Product.findOne({
      _id: toId(productId),
      businessId: toId(deps.businessId),
    }).lean();
    if (!productDoc) {
      await reply(deps.businessId, customer.id, deps.waId, "Product not found. Reply *menu*.");
      return;
    }

    const variants = await ProductVariant.find({
      productId: productDoc._id,
      businessId: toId(deps.businessId),
      isAvailable: true,
    })
      .sort({ createdAt: 1 })
      .lean();

    if (variants.length > 0) {
      const lines = variants.map(
        (v, i) => `${i + 1}. ${v.name} - ${deps.currency} ${toNumber(v.price).toFixed(2)}`,
      );
      await setSession(deps.businessId, customer.id, "AWAITING_QTY", {
        ...context,
        productId: productDoc._id.toString(),
        variants: variants.map((v) => v._id.toString()),
      });
      await reply(
        deps.businessId,
        customer.id,
        deps.waId,
        [
          `*${productDoc.name}* variants`,
          ...lines,
          "",
          "Reply with a variant number (qty defaults to 1).",
          "Or send `1 2` for variant + quantity.",
        ].join("\n"),
      );
      return;
    }

    await setSession(deps.businessId, customer.id, "AWAITING_QTY", {
      ...context,
      productId: productDoc._id.toString(),
      variantId: null,
    });
    await reply(
      deps.businessId,
      customer.id,
      deps.waId,
      `Selected *${productDoc.name}*.\nReply with quantity (e.g. 2)`,
    );
    return;
  }

  if (state === "AWAITING_QTY") {
    const parts = text.split(/\s+/).filter(Boolean);
    let variantId = context.variantId ?? null;
    let qty = Number(parts[0]);

    if (context.variants?.length) {
      const variantIndex = Number(parts[0]) - 1;
      variantId = context.variants[variantIndex] ?? null;
      qty = parts[1] !== undefined ? Number(parts[1]) : 1;
      if (!variantId || !Number.isInteger(qty) || qty < 1) {
        await reply(
          deps.businessId,
          customer.id,
          deps.waId,
          "Send a variant number (e.g. 1) or `1 2` for variant + quantity.",
        );
        return;
      }
    } else if (!Number.isInteger(qty) || qty < 1) {
      await reply(deps.businessId, customer.id, deps.waId, "Send a valid quantity (e.g. 2)");
      return;
    }

    if (!context.productId) {
      await reply(deps.businessId, customer.id, deps.waId, "Session expired. Reply *menu*.");
      return;
    }

    try {
      const cart = await addToCart({
        businessId: deps.businessId,
        customerId: customer.id,
        productId: context.productId,
        variantId,
        qty,
      });
      await setSession(deps.businessId, customer.id, "CART_REVIEW", {});
      await reply(
        deps.businessId,
        customer.id,
        deps.waId,
        `Added to cart.\n\n${formatCartText(cart, deps.currency)}`,
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Could not add to cart";
      await reply(deps.businessId, customer.id, deps.waId, msg);
    }
    return;
  }

  if (state === "AWAITING_ADDRESS") {
    const line1 = deps.text.trim();
    if (line1.length < 5) {
      await reply(deps.businessId, customer.id, deps.waId, "Please send a fuller delivery address.");
      return;
    }

    await CustomerAddress.create({
      businessId: toId(deps.businessId),
      customerId: toId(customer.id),
      line1,
      isDefault: true,
    });

    const cart = await getOrCreateActiveCart(deps.businessId, customer.id);
    await setSession(deps.businessId, customer.id, "AWAITING_CONFIRM", {});
    await reply(
      deps.businessId,
      customer.id,
      deps.waId,
      [
        "Address saved.",
        "",
        formatCartText(cart, deps.currency),
        "",
        "Payment: Cash on Delivery",
        "Reply *confirm* to place order, or *cancel* to abort.",
      ].join("\n"),
    );
    return;
  }

  if (state === "AWAITING_CONFIRM") {
    if (!["confirm", "yes", "ok"].includes(text)) {
      await reply(
        deps.businessId,
        customer.id,
        deps.waId,
        "Reply *confirm* to place the order, or *cancel*.",
      );
      return;
    }

    const cart = await getOrCreateActiveCart(deps.businessId, customer.id);
    if (cart.items.length === 0) {
      await reply(deps.businessId, customer.id, deps.waId, "Cart is empty. Reply *menu*.");
      await setSession(deps.businessId, customer.id, "IDLE", {});
      return;
    }

    const address = await CustomerAddress.findOne({
      businessId: toId(deps.businessId),
      customerId: toId(customer.id),
    })
      .sort({ isDefault: -1, createdAt: -1 })
      .select("_id")
      .lean();

    try {
      const order = await createOrder(deps.businessId, null, {
        customerId: customer.id,
        addressId: address?._id.toString(),
        notes: "Ordered via WhatsApp",
        items: cart.items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          qty: item.qty,
        })),
      });

      await markCartConverted(cart.id);
      await clearCart(deps.businessId, customer.id);
      await setSession(deps.businessId, customer.id, "IDLE", {});

      const confirmed =
        (await renderTemplate(deps.businessId, "ORDER_CONFIRMED", {
          order_number: order.orderNumber,
          business_name: deps.businessName,
        })) ||
        `Order *${order.orderNumber}* received. Total ${deps.currency} ${order.total.toFixed(2)}. We will update you on WhatsApp.`;

      await reply(deps.businessId, customer.id, deps.waId, confirmed);

      const owners = await User.find({
        businessId: toId(deps.businessId),
        role: { $in: ["OWNER", "ADMIN"] },
        isActive: true,
      }).select("_id");

      await Notification.insertMany(
        owners.map((owner) => ({
          businessId: toId(deps.businessId),
          userId: owner._id,
          type: "NEW_ORDER",
          title: `New WhatsApp order ${order.orderNumber}`,
          body: `${customer.name || customer.waId} · ${deps.currency} ${order.total.toFixed(2)}`,
          payload: { orderId: order.id },
        })),
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Could not place order";
      await reply(deps.businessId, customer.id, deps.waId, msg);
    }
    return;
  }

  await reply(deps.businessId, customer.id, deps.waId, helpText(deps.businessName));
}

module.exports = {
  handleInboundText,
};
