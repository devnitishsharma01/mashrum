"use strict";

const { toId } = require("../../db");
const { Customer, Business } = require("../../models");
const { sendTextToCustomer, renderTemplate } = require("./messaging.service");

async function notifyOrderStatusChange(params) {
  try {
    const customerDoc = await Customer.findOne({
      _id: toId(params.customerId),
      businessId: toId(params.businessId),
    })
      .select("waId")
      .lean();
    if (!customerDoc) return;

    const businessDoc = await Business.findById(toId(params.businessId)).select("name").lean();

    const body =
      (await renderTemplate(params.businessId, "ORDER_STATUS", {
        order_number: params.orderNumber,
        status: params.status.replaceAll("_", " "),
        business_name: businessDoc?.name || "our store",
      })) || `Order ${params.orderNumber} status: ${params.status.replaceAll("_", " ")}.`;

    await sendTextToCustomer({
      businessId: params.businessId,
      customerId: params.customerId,
      toWaId: customerDoc.waId,
      body,
    });
  } catch (error) {
    console.error("Failed to send order status WhatsApp notification:", error);
  }
}

module.exports = {
  notifyOrderStatusChange,
};
