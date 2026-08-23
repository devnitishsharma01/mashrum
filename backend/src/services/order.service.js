"use strict";

const { docToObject, withTransaction, sessionOpts, toId } = require("../db");
const {
  Order,
  Customer,
  CustomerAddress,
  Product,
  ProductVariant,
  Inventory,
  InventoryMovement,
  Payment,
  AuditLog,
} = require("../models");
const {
  canTransition,
  getAllowedTransitions,
  shouldDeductInventory,
  shouldRestoreInventory,
  KANBAN_COLUMNS,
} = require("../shared");
const { AppError } = require("../lib/errors");
const { enqueue } = require("../lib/queue");
const { toNumber } = require("../lib/money");

function serializeOrder(order) {
  return {
    ...order,
    subtotal: toNumber(order.subtotal),
    total: toNumber(order.total),
  };
}

async function nextOrderNumber(businessId, session) {
  let countQuery = Order.countDocuments({ businessId: toId(businessId) });
  if (session) countQuery = countQuery.session(session);
  const count = await countQuery;
  return `ORD-${1001 + count}`;
}

async function mapOrderItems(items) {
  const productIds = [...new Set(items.map((i) => i.productId?.toString()).filter(Boolean))];
  const variantIds = items.filter((i) => i.variantId).map((i) => i.variantId);

  const [products, variants] = await Promise.all([
    productIds.length
      ? Product.find({ _id: { $in: productIds.map(toId) } })
          .select("name")
          .lean()
      : [],
    variantIds.length
      ? ProductVariant.find({ _id: { $in: variantIds } })
          .select("name sku")
          .lean()
      : [],
  ]);

  const productMap = new Map(products.map((p) => [p._id.toString(), p]));
  const variantMap = new Map(variants.map((v) => [v._id.toString(), v]));

  return items.map((item) => {
    const productId = item.productId?.toString() || null;
    const variantId = item.variantId?.toString() || null;
    const product = productId ? productMap.get(productId) : null;
    const variant = variantId ? variantMap.get(variantId) : null;
    return {
      id: item._id?.toString(),
      productId,
      variantId,
      nameSnapshot: item.nameSnapshot,
      qty: item.qty,
      unitPrice: toNumber(item.unitPrice),
      lineTotal: toNumber(item.lineTotal),
      product: product ? { id: productId, name: product.name } : null,
      variant: variant ? { id: variantId, name: variant.name, sku: variant.sku } : null,
    };
  });
}

async function loadOrderDetail(businessId, orderId) {
  const orderDoc = await Order.findOne({
    _id: toId(orderId),
    businessId: toId(businessId),
  });
  if (!orderDoc) return null;

  const order = docToObject(orderDoc);
  const [customer, paymentDoc] = await Promise.all([
    Customer.findById(orderDoc.customerId).select("name waId").lean(),
    Payment.findOne({ orderId: orderDoc._id }).lean(),
  ]);

  order.customer = customer
    ? { id: customer._id.toString(), name: customer.name, waId: customer.waId }
    : null;

  order.items = await mapOrderItems(orderDoc.items || []);
  order.timeline = (orderDoc.timeline || []).map((t) => ({
    id: t._id?.toString(),
    fromStatus: t.fromStatus,
    toStatus: t.toStatus,
    actorType: t.actorType,
    actorId: t.actorId ? t.actorId.toString() : null,
    note: t.note,
    createdAt: t.createdAt,
  }));
  order.payment = paymentDoc
    ? {
        id: paymentDoc._id.toString(),
        businessId: paymentDoc.businessId.toString(),
        orderId: paymentDoc.orderId.toString(),
        method: paymentDoc.method,
        status: paymentDoc.status,
        amount: toNumber(paymentDoc.amount),
        collectedAt: paymentDoc.collectedAt,
        createdAt: paymentDoc.createdAt,
        updatedAt: paymentDoc.updatedAt,
      }
    : null;

  return {
    ...serializeOrder(order),
    allowedTransitions: getAllowedTransitions(order.status),
  };
}

async function getOrderOrThrow(businessId, orderId) {
  const order = await loadOrderDetail(businessId, orderId);
  if (!order) {
    throw new AppError(404, "Order not found", "NOT_FOUND");
  }
  return order;
}

async function applyInventoryDelta(session, businessId, orderId, items, direction) {
  for (const item of items) {
    if (!item.productId) continue;

    let inventoryQuery = Inventory.findOne({
      businessId: toId(businessId),
      productId: toId(item.productId),
      variantId: item.variantId ? toId(item.variantId) : null,
    });
    if (session) inventoryQuery = inventoryQuery.session(session);
    const inventory = await inventoryQuery;

    if (!inventory) {
      throw new AppError(400, "Inventory record missing for order item", "INVENTORY_MISSING");
    }

    const delta = direction === "DEDUCT" ? -item.qty : item.qty;
    const nextQty = inventory.quantityOnHand + delta;
    if (nextQty < 0) {
      throw new AppError(400, "Insufficient stock", "INSUFFICIENT_STOCK");
    }

    inventory.quantityOnHand = nextQty;
    await inventory.save(session ? { session } : undefined);

    await InventoryMovement.create(
      [
        {
          businessId: toId(businessId),
          inventoryId: inventory._id,
          delta,
          reason: direction === "DEDUCT" ? "ORDER_CONFIRM" : "ORDER_CANCEL_RESTORE",
          refType: "Order",
          refId: toId(orderId),
        },
      ],
      session ? { session } : undefined,
    );

    const updateOpts = session ? { session } : undefined;
    if (item.variantId) {
      await ProductVariant.updateOne(
        { _id: toId(item.variantId), businessId: toId(businessId), productId: toId(item.productId) },
        { isAvailable: nextQty > 0 },
        updateOpts,
      );
    } else {
      await Product.updateOne(
        { _id: toId(item.productId), businessId: toId(businessId) },
        { isAvailable: nextQty > 0 },
        updateOpts,
      );
    }
  }
}

async function listOrders(businessId, filters) {
  const query = { businessId: toId(businessId) };
  if (filters.status) query.status = filters.status;
  if (filters.paymentStatus) query.paymentStatus = filters.paymentStatus;
  if (filters.q) {
    const regex = new RegExp(filters.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const customers = await Customer.find({
      businessId: toId(businessId),
      $or: [{ name: regex }, { waId: new RegExp(filters.q.replace(/\D/g, "")) }],
    }).select("_id");
    query.$or = [
      { orderNumber: regex },
      { customerId: { $in: customers.map((c) => c._id) } },
    ];
  }

  const orderDocs = await Order.find(query).sort({ createdAt: -1 }).lean();
  const customerIds = [...new Set(orderDocs.map((o) => o.customerId.toString()))];
  const orderIds = orderDocs.map((o) => o._id);

  const [customers, payments] = await Promise.all([
    Customer.find({ _id: { $in: customerIds.map(toId) } })
      .select("name waId")
      .lean(),
    Payment.find({ orderId: { $in: orderIds } }).lean(),
  ]);

  const customerMap = new Map(customers.map((c) => [c._id.toString(), c]));
  const paymentMap = new Map(payments.map((p) => [p.orderId.toString(), p]));

  const serialized = orderDocs.map((row) => {
    const customer = customerMap.get(row.customerId.toString());
    const payment = paymentMap.get(row._id.toString());
    const order = serializeOrder({
      id: row._id.toString(),
      businessId: row.businessId.toString(),
      customerId: row.customerId.toString(),
      orderNumber: row.orderNumber,
      status: row.status,
      paymentMethod: row.paymentMethod,
      paymentStatus: row.paymentStatus,
      subtotal: row.subtotal,
      total: row.total,
      deliveryAddressSnapshot: row.deliveryAddressSnapshot,
      notes: row.notes,
      stockReserved: row.stockReserved,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });

    order.customer = customer
      ? { id: customer._id.toString(), name: customer.name, waId: customer.waId }
      : null;
    order.payment = payment
      ? {
          id: payment._id.toString(),
          status: payment.status,
          amount: toNumber(payment.amount),
        }
      : null;
    order._count = { items: (row.items || []).length };
    order.allowedTransitions = getAllowedTransitions(order.status);
    return order;
  });

  if (filters.view === "kanban") {
    const columns = Object.fromEntries(KANBAN_COLUMNS.map((status) => [status, []]));
    for (const order of serialized) {
      if (order.status in columns) {
        columns[order.status].push(order);
      }
    }
    return { view: "kanban", columns };
  }

  return { view: "list", orders: serialized };
}

async function getOrder(businessId, orderId) {
  return getOrderOrThrow(businessId, orderId);
}

async function createOrder(businessId, actorUserId, input) {
  const customerDoc = await Customer.findOne({
    _id: toId(input.customerId),
    businessId: toId(businessId),
  });
  if (!customerDoc) {
    throw new AppError(404, "Customer not found", "NOT_FOUND");
  }

  const customerAddresses = await CustomerAddress.find({
    businessId: toId(businessId),
    customerId: customerDoc._id,
  }).lean();

  let deliveryAddress = input.deliveryAddress ?? null;
  if (input.addressId) {
    const address = customerAddresses.find((a) => a._id.toString() === input.addressId);
    if (!address) {
      throw new AppError(400, "Address not found", "INVALID_ADDRESS");
    }
    deliveryAddress = {
      line1: address.line1,
      landmark: address.landmark,
      city: address.city,
    };
  } else if (!deliveryAddress) {
    const fallback = customerAddresses.find((a) => a.isDefault) ?? customerAddresses[0];
    if (fallback) {
      deliveryAddress = {
        line1: fallback.line1,
        landmark: fallback.landmark,
        city: fallback.city,
      };
    }
  }

  const lineInputs = [];
  for (const item of input.items) {
    const productDoc = await Product.findOne({
      _id: toId(item.productId),
      businessId: toId(businessId),
    });
    if (!productDoc) {
      throw new AppError(400, "Product not found", "INVALID_PRODUCT");
    }
    if (!productDoc.isAvailable || !productDoc.isVisible) {
      throw new AppError(400, `Product "${productDoc.name}" is unavailable`, "PRODUCT_UNAVAILABLE");
    }

    let unitPrice = toNumber(productDoc.basePrice);
    let nameSnapshot = productDoc.name;
    const variantId = item.variantId ?? null;

    if (variantId) {
      const variantDoc = await ProductVariant.findOne({
        _id: toId(variantId),
        businessId: toId(businessId),
        productId: productDoc._id,
      });
      if (!variantDoc || !variantDoc.isAvailable) {
        throw new AppError(400, "Variant unavailable", "VARIANT_UNAVAILABLE");
      }
      unitPrice = toNumber(variantDoc.price);
      nameSnapshot = `${productDoc.name} · ${variantDoc.name}`;
    }

    const inventory = await Inventory.findOne({
      businessId: toId(businessId),
      productId: productDoc._id,
      variantId: variantId ? toId(variantId) : null,
    });

    if (!inventory || inventory.quantityOnHand < item.qty) {
      throw new AppError(400, `Insufficient stock for ${nameSnapshot}`, "INSUFFICIENT_STOCK");
    }

    lineInputs.push({
      productId: productDoc._id,
      variantId: variantId ? toId(variantId) : null,
      nameSnapshot,
      qty: item.qty,
      unitPrice,
      lineTotal: unitPrice * item.qty,
    });
  }

  const subtotal = lineInputs.reduce((sum, line) => sum + line.lineTotal, 0);
  const total = subtotal;

  const orderId = await withTransaction(async (session) => {
    const opts = sessionOpts(session);
    const orderNumber = await nextOrderNumber(businessId, session);

    const order = await Order.create(
      [
        {
          businessId: toId(businessId),
          customerId: customerDoc._id,
          orderNumber,
          status: "NEW",
          paymentMethod: "COD",
          paymentStatus: "PENDING",
          subtotal,
          total,
          deliveryAddressSnapshot: deliveryAddress,
          notes: input.notes ?? null,
          stockReserved: false,
          items: lineInputs,
          timeline: [
            {
              fromStatus: null,
              toStatus: "NEW",
              actorType: actorUserId ? "USER" : "CUSTOMER",
              actorId: actorUserId ? toId(actorUserId) : null,
              note: actorUserId ? "Order created" : "Order created via WhatsApp",
              createdAt: new Date(),
            },
          ],
        },
      ],
      opts,
    ).then((docs) => docs[0]);

    await Payment.create(
      [
        {
          businessId: toId(businessId),
          orderId: order._id,
          method: "COD",
          status: "PENDING",
          amount: total,
        },
      ],
      opts,
    );

    await AuditLog.create(
      [
        {
          businessId: toId(businessId),
          actorUserId: actorUserId ? toId(actorUserId) : null,
          action: "ORDER_CREATED",
          entity: "Order",
          entityId: order._id,
          meta: { orderNumber, source: actorUserId ? "ADMIN" : "WHATSAPP" },
        },
      ],
      opts,
    );

    return order._id.toString();
  });

  return getOrderOrThrow(businessId, orderId);
}

async function transitionOrder(businessId, actorUserId, orderId, input) {
  const orderDoc = await Order.findOne({
    _id: toId(orderId),
    businessId: toId(businessId),
  });
  if (!orderDoc) {
    throw new AppError(404, "Order not found", "NOT_FOUND");
  }

  const existing = docToObject(orderDoc);
  const items = (orderDoc.items || []).map((item) => ({
    productId: item.productId?.toString(),
    variantId: item.variantId ? item.variantId.toString() : null,
    qty: item.qty,
  }));

  const paymentDoc = await Payment.findOne({ orderId: orderDoc._id });
  const payment = paymentDoc ? docToObject(paymentDoc) : null;

  if (!canTransition(existing.status, input.status)) {
    throw new AppError(
      400,
      `Cannot transition from ${existing.status} to ${input.status}`,
      "INVALID_TRANSITION",
    );
  }

  if (input.status === "COMPLETED") {
    const paymentStatus = payment?.status ?? existing.paymentStatus;
    if (paymentStatus !== "COLLECTED") {
      throw new AppError(
        400,
        "Mark COD as collected before completing the order",
        "PAYMENT_REQUIRED",
      );
    }
  }

  await withTransaction(async (session) => {
    const opts = sessionOpts(session);
    let stockReserved = orderDoc.stockReserved;
    let paymentStatus = orderDoc.paymentStatus;

    if (shouldDeductInventory(existing.status, input.status)) {
      await applyInventoryDelta(session, businessId, orderId, items, "DEDUCT");
      stockReserved = true;
    }

    if (shouldRestoreInventory(existing.status, input.status, existing.stockReserved)) {
      await applyInventoryDelta(session, businessId, orderId, items, "RESTORE");
      stockReserved = false;
      paymentStatus = "CANCELLED";
      if (paymentDoc) {
        paymentDoc.status = "CANCELLED";
        await paymentDoc.save(opts);
      }
    }

    if (input.status === "CANCELLED" && !existing.stockReserved) {
      paymentStatus = "CANCELLED";
      if (paymentDoc) {
        paymentDoc.status = "CANCELLED";
        await paymentDoc.save(opts);
      }
    }

    orderDoc.status = input.status;
    orderDoc.stockReserved = stockReserved;
    orderDoc.paymentStatus = paymentStatus;
    orderDoc.timeline.push({
      fromStatus: existing.status,
      toStatus: input.status,
      actorType: "USER",
      actorId: toId(actorUserId),
      note: input.note ?? null,
      createdAt: new Date(),
    });
    await orderDoc.save(opts);

    await AuditLog.create(
      [
        {
          businessId: toId(businessId),
          actorUserId: toId(actorUserId),
          action: "ORDER_STATUS_CHANGED",
          entity: "Order",
          entityId: orderDoc._id,
          meta: { from: existing.status, to: input.status, note: input.note },
        },
      ],
      opts,
    );
  });

  void enqueue("whatsapp.order_status", {
    businessId,
    orderId,
    orderNumber: existing.orderNumber,
    status: input.status,
    customerId: existing.customerId,
  });

  return getOrderOrThrow(businessId, orderId);
}

async function updateOrderPayment(businessId, actorUserId, orderId, input) {
  const orderDoc = await Order.findOne({
    _id: toId(orderId),
    businessId: toId(businessId),
  });
  if (!orderDoc) {
    throw new AppError(404, "Order not found", "NOT_FOUND");
  }

  const paymentDoc = await Payment.findOne({ orderId: orderDoc._id });
  if (!paymentDoc) {
    throw new AppError(400, "Payment record missing", "PAYMENT_MISSING");
  }
  if (orderDoc.status === "CANCELLED") {
    throw new AppError(400, "Cannot update payment on cancelled order", "INVALID");
  }

  await withTransaction(async (session) => {
    const opts = sessionOpts(session);
    paymentDoc.status = input.status;
    paymentDoc.collectedAt = input.status === "COLLECTED" ? new Date() : null;
    await paymentDoc.save(opts);

    orderDoc.paymentStatus = input.status;
    await orderDoc.save(opts);

    await AuditLog.create(
      [
        {
          businessId: toId(businessId),
          actorUserId: toId(actorUserId),
          action: "PAYMENT_UPDATED",
          entity: "Payment",
          entityId: paymentDoc._id,
          meta: { orderId, status: input.status },
        },
      ],
      opts,
    );
  });

  return getOrderOrThrow(businessId, orderId);
}

module.exports = {
  listOrders,
  getOrder,
  createOrder,
  transitionOrder,
  updateOrderPayment,
};
