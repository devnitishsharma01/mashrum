"use strict";

const { docToObject, withTransaction, sessionOpts, toId } = require("../db");
const { Customer, CustomerAddress, Order, AuditLog } = require("../models");
const { AppError } = require("../lib/errors");
const { toNumber } = require("../lib/money");

function normalizeWaId(waId) {
  return waId.replace(/[^\d+]/g, "");
}

async function loadAddresses(businessId, customerIds) {
  if (customerIds.length === 0) return new Map();
  const rows = await CustomerAddress.find({
    businessId: toId(businessId),
    customerId: { $in: customerIds.map(toId) },
  })
    .sort({ isDefault: -1, createdAt: -1 })
    .lean();

  const map = new Map();
  for (const row of rows) {
    const address = {
      id: row._id.toString(),
      businessId: row.businessId.toString(),
      customerId: row.customerId.toString(),
      line1: row.line1,
      landmark: row.landmark,
      city: row.city,
      isDefault: row.isDefault,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
    if (!map.has(address.customerId)) map.set(address.customerId, []);
    map.get(address.customerId).push(address);
  }
  return map;
}

async function listCustomers(businessId, q) {
  const query = { businessId: toId(businessId) };
  if (q) {
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    query.$or = [{ name: regex }, { waId: new RegExp(q.replace(/\D/g, "")) }, { notes: regex }];
  }

  const customers = await Customer.find(query)
    .sort({ lastMessageAt: -1, createdAt: -1 })
    .lean();

  const customerIds = customers.map((c) => c._id.toString());
  const addressMap = await loadAddresses(businessId, customerIds);

  const orderCounts = await Order.aggregate([
    { $match: { businessId: toId(businessId), customerId: { $in: customers.map((c) => c._id) } } },
    { $group: { _id: "$customerId", count: { $sum: 1 } } },
  ]);
  const countMap = new Map(orderCounts.map((c) => [c._id.toString(), c.count]));

  return customers.map((row) => {
    const id = row._id.toString();
    return {
      id,
      businessId: row.businessId.toString(),
      waId: row.waId,
      name: row.name,
      notes: row.notes,
      lastMessageAt: row.lastMessageAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      addresses: addressMap.get(id) ?? [],
      _count: { orders: countMap.get(id) || 0 },
    };
  });
}

async function getCustomer(businessId, customerId) {
  const row = await Customer.findOne({
    _id: toId(customerId),
    businessId: toId(businessId),
  }).lean();
  if (!row) {
    throw new AppError(404, "Customer not found", "NOT_FOUND");
  }

  const [addresses, orders, orderCount] = await Promise.all([
    CustomerAddress.find({ businessId: toId(businessId), customerId: toId(customerId) })
      .sort({ isDefault: -1, createdAt: -1 })
      .lean(),
    Order.find({ businessId: toId(businessId), customerId: toId(customerId) })
      .select("orderNumber status paymentStatus total createdAt")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean(),
    Order.countDocuments({ businessId: toId(businessId), customerId: toId(customerId) }),
  ]);

  return {
    id: row._id.toString(),
    businessId: row.businessId.toString(),
    waId: row.waId,
    name: row.name,
    notes: row.notes,
    lastMessageAt: row.lastMessageAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    addresses: addresses.map((a) => ({
      id: a._id.toString(),
      businessId: a.businessId.toString(),
      customerId: a.customerId.toString(),
      line1: a.line1,
      landmark: a.landmark,
      city: a.city,
      isDefault: a.isDefault,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    })),
    orders: orders.map((o) => ({
      id: o._id.toString(),
      orderNumber: o.orderNumber,
      status: o.status,
      paymentStatus: o.paymentStatus,
      total: toNumber(o.total),
      createdAt: o.createdAt,
    })),
    _count: { orders: orderCount },
  };
}

async function createCustomer(businessId, actorUserId, input) {
  const waId = normalizeWaId(input.waId);
  const existing = await Customer.findOne({
    businessId: toId(businessId),
    waId,
  })
    .select("_id")
    .lean();
  if (existing) {
    throw new AppError(409, "Customer already exists", "CUSTOMER_EXISTS");
  }

  let customerId;
  await withTransaction(async (session) => {
    const opts = sessionOpts(session);
    const customer = await Customer.create(
      [
        {
          businessId: toId(businessId),
          waId,
          name: input.name ?? null,
          notes: input.notes ?? null,
        },
      ],
      opts,
    ).then((docs) => docs[0]);

    customerId = customer._id.toString();

    if (input.address) {
      await CustomerAddress.create(
        [
          {
            businessId: toId(businessId),
            customerId: customer._id,
            line1: input.address.line1,
            landmark: input.address.landmark ?? null,
            city: input.address.city ?? null,
            isDefault: input.address.isDefault ?? true,
          },
        ],
        opts,
      );
    }

    await AuditLog.create(
      [
        {
          businessId: toId(businessId),
          actorUserId: toId(actorUserId),
          action: "CUSTOMER_CREATED",
          entity: "Customer",
          entityId: customer._id,
        },
      ],
      opts,
    );
  });

  return getCustomer(businessId, customerId);
}

async function updateCustomer(businessId, actorUserId, customerId, input) {
  const existing = await Customer.findOne({
    _id: toId(customerId),
    businessId: toId(businessId),
  });
  if (!existing) {
    throw new AppError(404, "Customer not found", "NOT_FOUND");
  }

  if (input.name !== undefined) existing.name = input.name;
  if (input.notes !== undefined) existing.notes = input.notes;
  await existing.save();

  await AuditLog.create({
    businessId: toId(businessId),
    actorUserId: toId(actorUserId),
    action: "CUSTOMER_UPDATED",
    entity: "Customer",
    entityId: existing._id,
    meta: input,
  });

  return getCustomer(businessId, customerId);
}

async function addCustomerAddress(businessId, actorUserId, customerId, input) {
  const customer = await Customer.findOne({
    _id: toId(customerId),
    businessId: toId(businessId),
  })
    .select("_id")
    .lean();
  if (!customer) {
    throw new AppError(404, "Customer not found", "NOT_FOUND");
  }

  if (input.isDefault) {
    await CustomerAddress.updateMany(
      { businessId: toId(businessId), customerId: toId(customerId) },
      { isDefault: false },
    );
  }

  const addressDoc = await CustomerAddress.create({
    businessId: toId(businessId),
    customerId: toId(customerId),
    line1: input.line1,
    landmark: input.landmark ?? null,
    city: input.city ?? null,
    isDefault: input.isDefault ?? false,
  });

  await AuditLog.create({
    businessId: toId(businessId),
    actorUserId: toId(actorUserId),
    action: "CUSTOMER_ADDRESS_ADDED",
    entity: "CustomerAddress",
    entityId: addressDoc._id,
    meta: { customerId },
  });

  return docToObject(addressDoc);
}

async function upsertCustomerByWaId(businessId, waId, name) {
  const normalized = normalizeWaId(waId);
  const customer = await Customer.findOneAndUpdate(
    { businessId: toId(businessId), waId: normalized },
    {
      $set: {
        lastMessageAt: new Date(),
        ...(name ? { name } : {}),
      },
      $setOnInsert: {
        businessId: toId(businessId),
        waId: normalized,
        name: name ?? null,
      },
    },
    { upsert: true, new: true },
  );
  return docToObject(customer);
}

module.exports = {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  addCustomerAddress,
  upsertCustomerByWaId,
};
