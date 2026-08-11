import { prisma } from "@mashrum/database";
import { getRangeBounds } from "../lib/datetime";
import { toNumber } from "../lib/money";

export async function getSalesReport(
  businessId: string,
  from?: string,
  to?: string,
) {
  const business = await prisma.business.findFirstOrThrow({
    where: { id: businessId },
    select: { timezone: true, currency: true },
  });

  const range = getRangeBounds(business.timezone, from, to);

  const orders = await prisma.order.findMany({
    where: {
      businessId,
      createdAt: { gte: range.start, lte: range.end },
    },
    include: {
      items: {
        select: {
          nameSnapshot: true,
          qty: true,
          lineTotal: true,
          productId: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const byStatus: Record<string, { count: number; total: number }> = {};
  const byPayment: Record<string, { count: number; total: number }> = {};
  const productMap = new Map<
    string,
    { name: string; qty: number; revenue: number }
  >();

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

    for (const item of order.items) {
      if (order.status === "CANCELLED") continue;
      const key = item.productId || item.nameSnapshot;
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

  return {
    range: { from: range.from, to: range.to, timezone: business.timezone },
    currency: business.currency,
    summary: {
      orders: orders.length,
      grossSales,
      cancelledSales,
      collectedSales,
      averageOrderValue:
        orders.filter((o) => o.status !== "CANCELLED").length > 0
          ? grossSales /
            orders.filter((o) => o.status !== "CANCELLED").length
          : 0,
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
