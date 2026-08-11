import { prisma } from "@mashrum/database";
import { getZonedDayBounds } from "../lib/datetime";
import { toNumber } from "../lib/money";

const OPEN_STATUSES = [
  "NEW",
  "CONFIRMED",
  "PROCESSING",
  "READY",
  "OUT_FOR_DELIVERY",
  "CUSTOMER_NOT_REACHABLE",
  "DELIVERY_FAILED",
] as const;

export async function getDashboardSummary(businessId: string) {
  const business = await prisma.business.findFirstOrThrow({
    where: { id: businessId },
    select: {
      currency: true,
      timezone: true,
      codEnabled: true,
      name: true,
      whatsappAccount: { select: { status: true } },
    },
  });

  const { start, end, dateStr } = getZonedDayBounds(business.timezone);

  const [
    ordersToday,
    openOrders,
    pendingPayments,
    todayOrders,
    lowStock,
    recentOrders,
  ] = await Promise.all([
    prisma.order.count({
      where: { businessId, createdAt: { gte: start, lte: end } },
    }),
    prisma.order.count({
      where: { businessId, status: { in: [...OPEN_STATUSES] } },
    }),
    prisma.order.count({
      where: {
        businessId,
        paymentStatus: "PENDING",
        status: { notIn: ["CANCELLED"] },
      },
    }),
    prisma.order.findMany({
      where: {
        businessId,
        createdAt: { gte: start, lte: end },
        status: { not: "CANCELLED" },
      },
      select: { total: true, status: true, paymentStatus: true },
    }),
    prisma.inventory.count({
      where: { businessId, quantityOnHand: { lte: 5 } },
    }),
    prisma.order.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        total: true,
        createdAt: true,
        customer: { select: { name: true, waId: true } },
      },
    }),
  ]);

  const statusCounts = todayOrders.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});

  const todaySales = todayOrders.reduce(
    (sum, o) => sum + toNumber(o.total),
    0,
  );
  const todayCollected = todayOrders
    .filter((o) => o.paymentStatus === "COLLECTED")
    .reduce((sum, o) => sum + toNumber(o.total), 0);

  return {
    date: dateStr,
    timezone: business.timezone,
    currency: business.currency,
    codEnabled: business.codEnabled,
    whatsappStatus: business.whatsappAccount?.status || "DISCONNECTED",
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
      ...o,
      total: toNumber(o.total),
    })),
  };
}
