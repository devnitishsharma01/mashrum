"use strict";

const { toId } = require("../db");
const { Business, WhatsAppAccount, Order, Inventory } = require("../models");
const { getZonedDayBounds } = require("../lib/datetime");
const { toNumber } = require("../lib/money");

const OPEN_STATUSES = [
  "NEW",
  "CONFIRMED",
  "PROCESSING",
  "READY",
  "OUT_FOR_DELIVERY",
  "CUSTOMER_NOT_REACHABLE",
  "DELIVERY_FAILED",
];

async function getDashboardSummary(businessId) {
  const businessDoc = await Business.findById(toId(businessId)).lean();
  if (!businessDoc) {
    throw new Error("Business not found");
  }

  const waDoc = await WhatsAppAccount.findOne({ businessId: businessDoc._id })
    .select("status")
    .lean();

  const { start, end, dateStr } = getZonedDayBounds(businessDoc.timezone);

  const [
    ordersToday,
    openOrders,
    pendingPayments,
    todayOrders,
    lowStock,
    recentOrders,
  ] = await Promise.all([
    Order.countDocuments({
      businessId: toId(businessId),
      createdAt: { $gte: start, $lte: end },
    }),
    Order.countDocuments({
      businessId: toId(businessId),
      status: { $in: OPEN_STATUSES },
    }),
    Order.countDocuments({
      businessId: toId(businessId),
      paymentStatus: "PENDING",
      status: { $ne: "CANCELLED" },
    }),
    Order.find({
      businessId: toId(businessId),
      createdAt: { $gte: start, $lte: end },
      status: { $ne: "CANCELLED" },
    })
      .select("total status paymentStatus")
      .lean(),
    Inventory.countDocuments({
      businessId: toId(businessId),
      quantityOnHand: { $lte: 5 },
    }),
    Order.find({ businessId: toId(businessId) })
      .sort({ createdAt: -1 })
      .limit(8)
      .populate({ path: "customerId", select: "name waId" })
      .select("orderNumber status paymentStatus total createdAt customerId")
      .lean(),
  ]);

  const statusCounts = todayOrders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});

  const todaySales = todayOrders.reduce((sum, o) => sum + toNumber(o.total), 0);
  const todayCollected = todayOrders
    .filter((o) => o.paymentStatus === "COLLECTED")
    .reduce((sum, o) => sum + toNumber(o.total), 0);

  return {
    date: dateStr,
    timezone: businessDoc.timezone,
    currency: businessDoc.currency,
    codEnabled: businessDoc.codEnabled,
    whatsappStatus: waDoc?.status || "DISCONNECTED",
    metrics: {
      ordersToday,
      openOrders,
      pendingPayments,
      todaySales,
      todayCollected,
      confirmedToday: statusCounts.CONFIRMED || 0,
      deliveredToday: statusCounts.DELIVERED || 0,
      completedToday: statusCounts.COMPLETED || 0,
      lowStockItems: lowStock,
    },
    recentOrders: recentOrders.map((o) => ({
      id: o._id.toString(),
      orderNumber: o.orderNumber,
      status: o.status,
      paymentStatus: o.paymentStatus,
      total: toNumber(o.total),
      createdAt: o.createdAt,
      customer: {
        name: o.customerId?.name,
        waId: o.customerId?.waId,
      },
    })),
  };
}

module.exports = {
  getDashboardSummary,
};
