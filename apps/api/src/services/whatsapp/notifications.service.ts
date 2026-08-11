import { prisma } from "@mashrum/database";
import { renderTemplate, sendTextToCustomer } from "./messaging.service";

export async function notifyOrderStatusChange(params: {
  businessId: string;
  orderId: string;
  orderNumber: string;
  status: string;
  customerId: string;
}): Promise<void> {
  try {
    const customer = await prisma.customer.findFirst({
      where: { id: params.customerId, businessId: params.businessId },
      select: { id: true, waId: true },
    });
    if (!customer) return;

    const business = await prisma.business.findFirst({
      where: { id: params.businessId },
      select: { name: true },
    });

    const body =
      (await renderTemplate(params.businessId, "ORDER_STATUS", {
        order_number: params.orderNumber,
        status: params.status.replaceAll("_", " "),
        business_name: business?.name || "our store",
      })) ||
      `Order ${params.orderNumber} status: ${params.status.replaceAll("_", " ")}.`;

    await sendTextToCustomer({
      businessId: params.businessId,
      customerId: customer.id,
      toWaId: customer.waId,
      body,
    });
  } catch (error) {
    console.error("Failed to send order status WhatsApp notification:", error);
  }
}
