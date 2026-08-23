"use strict";

const { toId } = require("../db");
const { Business, Order } = require("../models");
const { getRangeBounds } = require("../lib/datetime");
const { toNumber } = require("../lib/money");

async function getSalesReport(businessId, from, to) {
  const businessDoc = await Business.findById(toId(businessId)).select("timezone currency").lean();
  if (!businessDoc) {
    throw new Error("Business not found");
  }

  const range = getRangeBounds(businessDoc.timezone, from, to);

  const orders = await Order.find({
    businessId: toId(businessId),
    createdAt: { $gte: range.start, $lte: range.end },
  })
    .select("status paymentStatus total items")
    .sort({ createdAt: -1 })
    .lean();

  const byStatus = {};
  const byPayment = {};
  const productMap = new Map();

  let grossSales = 0;
  let cancelledSales = 0;
  let collectedSales = 0;

  for (const order of orders) {
    const total = toNumber(order.total);
    byStatus[order.status] ||= { count: 0, total: 0 };
    byStatus[order.status].count += 1;
    byStatus[order.status].total += total;

    byPayment[order.paymentStatus] ||= { count: 0, total: 0 };
    byPayment[order.paymentStatus].count += 1;
    byPayment[order.paymentStatus].total += total;

    if (order.status === "CANCELLED") {
      cancelledSales += total;
    } else {
      grossSales += total;
    }
    if (order.paymentStatus === "COLLECTED") {
      collectedSales += total;
    }

    const items = order.items || [];
    for (const item of items) {
      if (order.status === "CANCELLED") continue;
      const key = item.productId?.toString() || item.nameSnapshot;
      const current = productMap.get(key) || {
        name: item.nameSnapshot,
        qty: 0,
        revenue: 0,
      };
      current.qty += item.qty;
      current.revenue += toNumber(item.lineTotal);
      productMap.set(key, current);
    }
  }

  const topProducts = [...productMap.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const orderCount = orders.length;
  const nonCancelledCount = orders.filter((o) => o.status !== "CANCELLED").length;

  return {
    range: { from: range.from, to: range.to, timezone: businessDoc.timezone },
    currency: businessDoc.currency,
    summary: {
      orders: orderCount,
      grossSales,
      cancelledSales,
      collectedSales,
      averageOrderValue: nonCancelledCount > 0 ? grossSales / nonCancelledCount : 0,
    },
    byStatus: Object.entries(byStatus).map(([status, value]) => ({
      status,
      ...value,
    })),
    byPayment: Object.entries(byPayment).map(([paymentStatus, value]) => ({
      paymentStatus,
      ...value,
    })),
    topProducts,
  };
}

module.exports = {
  getSalesReport,
};
