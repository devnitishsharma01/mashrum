import { prisma } from "@mashrum/database";
import {
  isBusinessOpen,
  type BotState,
  type WorkingHours,
} from "@mashrum/shared";
import { toNumber } from "../../lib/money";
import {
  addToCart,
  clearCart,
  formatCartText,
  getOrCreateActiveCart,
  markCartConverted,
} from "../cart.service";
import { createOrder } from "../order.service";
import { upsertCustomerByWaId } from "../customer.service";
import { renderTemplate, sendTextToCustomer } from "./messaging.service";

type SessionContext = {
  categoryId?: string;
  productId?: string;
  variantId?: string | null;
  products?: string[];
  variants?: string[];
};

type BotDeps = {
  businessId: string;
  businessName: string;
  currency: string;
  waId: string;
  contactName?: string;
  text: string;
};

async function getSession(businessId: string, customerId: string) {
  return prisma.conversationSession.upsert({
    where: {
      businessId_customerId: { businessId, customerId },
    },
    create: {
      businessId,
      customerId,
      state: "IDLE",
      context: {},
    },
    update: {},
  });
}

async function setSession(
  businessId: string,
  customerId: string,
  state: BotState,
  context: SessionContext = {},
) {
  return prisma.conversationSession.upsert({
    where: {
      businessId_customerId: { businessId, customerId },
    },
    create: {
      businessId,
      customerId,
      state,
      context,
    },
    update: {
      state,
      context,
    },
  });
}

async function reply(
  businessId: string,
  customerId: string,
  waId: string,
  body: string,
) {
  await sendTextToCustomer({
    businessId,
    customerId,
    toWaId: waId,
    body,
  });
}

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

async function listVisibleCategories(businessId: string) {
  return prisma.category.findMany({
    where: { businessId, isVisible: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

async function listVisibleProducts(businessId: string, categoryId?: string) {
  return prisma.product.findMany({
    where: {
      businessId,
      isVisible: true,
      isAvailable: true,
      ...(categoryId ? { categoryId } : {}),
    },
    include: {
      variants: {
        where: { isAvailable: true },
        orderBy: { createdAt: "asc" },
      },
      inventory: {
        where: { businessId, variantId: null },
        select: { quantityOnHand: true },
      },
    },
    orderBy: { name: "asc" },
    take: 20,
  });
}

function helpText(businessName: string): string {
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

async function showCategories(
  deps: BotDeps,
  customerId: string,
): Promise<void> {
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
      (p, i) =>
        `${i + 1}. ${p.name} - ${deps.currency} ${toNumber(p.basePrice).toFixed(2)}`,
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
    ["*Categories*", ...lines, "", "Reply with a number to open a category."].join(
      "\n",
    ),
  );
}

export async function handleInboundText(deps: BotDeps): Promise<void> {
  const customer = await upsertCustomerByWaId(
    deps.businessId,
    deps.waId,
    deps.contactName,
  );
  const session = await getSession(deps.businessId, customer.id);
  const context = (session.context || {}) as SessionContext;
  const text = normalize(deps.text);
  const state = session.state as BotState;

  const business = await prisma.business.findFirst({
    where: { id: deps.businessId },
    select: { workingHours: true, timezone: true },
  });
  if (business) {
    const open = isBusinessOpen(
      business.workingHours as WorkingHours,
      business.timezone,
    );
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
    await reply(
      deps.businessId,
      customer.id,
      deps.waId,
      formatCartText(cart, deps.currency),
    );
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
      await reply(
        deps.businessId,
        customer.id,
        deps.waId,
        "No products in this category. Reply *menu*.",
      );
      return;
    }

    const lines = products.map(
      (p, i) =>
        `${i + 1}. ${p.name} - ${deps.currency} ${toNumber(p.basePrice).toFixed(2)}`,
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

    const product = await prisma.product.findFirst({
      where: { id: productId, businessId: deps.businessId },
      include: {
        variants: { where: { isAvailable: true }, orderBy: { createdAt: "asc" } },
      },
    });
    if (!product) {
      await reply(
        deps.businessId,
        customer.id,
        deps.waId,
        "Product not found. Reply *menu*.",
      );
      return;
    }

    if (product.variants.length > 0) {
      const lines = product.variants.map(
        (v, i) =>
          `${i + 1}. ${v.name} - ${deps.currency} ${toNumber(v.price).toFixed(2)}`,
      );
      await setSession(deps.businessId, customer.id, "AWAITING_QTY", {
        ...context,
        productId: product.id,
        variants: product.variants.map((v) => v.id),
      });
      await reply(
        deps.businessId,
        customer.id,
        deps.waId,
        [
          `*${product.name}* variants`,
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
      productId: product.id,
      variantId: null,
    });
    await reply(
      deps.businessId,
      customer.id,
      deps.waId,
      `Selected *${product.name}*.\nReply with quantity (e.g. 2)`,
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
      // `1` => variant 1 qty 1; `1 2` => variant 1 qty 2
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
      await reply(
        deps.businessId,
        customer.id,
        deps.waId,
        "Send a valid quantity (e.g. 2)",
      );
      return;
    }

    if (!context.productId) {
      await reply(
        deps.businessId,
        customer.id,
        deps.waId,
        "Session expired. Reply *menu*.",
      );
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
      const msg =
        error instanceof Error ? error.message : "Could not add to cart";
      await reply(deps.businessId, customer.id, deps.waId, msg);
    }
    return;
  }

  if (state === "AWAITING_ADDRESS") {
    const line1 = deps.text.trim();
    if (line1.length < 5) {
      await reply(
        deps.businessId,
        customer.id,
        deps.waId,
        "Please send a fuller delivery address.",
      );
      return;
    }

    await prisma.customerAddress.create({
      data: {
        businessId: deps.businessId,
        customerId: customer.id,
        line1,
        isDefault: true,
      },
    });

    const cart = await getOrCreateActiveCart(deps.businessId, customer.id);
    await setSession(deps.businessId, customer.id, "AWAITING_CONFIRM", {
      // reuse products field unused; address kept on customer default
    });
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
      await reply(
        deps.businessId,
        customer.id,
        deps.waId,
        "Cart is empty. Reply *menu*.",
      );
      await setSession(deps.businessId, customer.id, "IDLE", {});
      return;
    }

    const address = await prisma.customerAddress.findFirst({
      where: { businessId: deps.businessId, customerId: customer.id },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });

    try {
      const order = await createOrder(deps.businessId, null, {
        customerId: customer.id,
        addressId: address?.id,
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

      // Notify business owner(s)
      const owners = await prisma.user.findMany({
        where: {
          businessId: deps.businessId,
          role: { in: ["OWNER", "ADMIN"] },
          isActive: true,
        },
        select: { id: true },
      });
      if (owners.length > 0) {
        await prisma.notification.createMany({
          data: owners.map((user) => ({
            businessId: deps.businessId,
            userId: user.id,
            type: "NEW_ORDER",
            title: `New WhatsApp order ${order.orderNumber}`,
            body: `${customer.name || customer.waId} · ${deps.currency} ${order.total.toFixed(2)}`,
            payload: { orderId: order.id },
          })),
        });
      }
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Could not place order";
      await reply(deps.businessId, customer.id, deps.waId, msg);
    }
    return;
  }

  await reply(
    deps.businessId,
    customer.id,
    deps.waId,
    helpText(deps.businessName),
  );
}
