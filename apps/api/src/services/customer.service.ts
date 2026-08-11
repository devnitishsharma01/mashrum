import { prisma } from "@mashrum/database";
import type {
  CreateCustomerAddressInput,
  CreateCustomerInput,
  UpdateCustomerInput,
} from "@mashrum/shared";
import { AppError } from "../lib/errors";

function normalizeWaId(waId: string): string {
  return waId.replace(/[^\d+]/g, "");
}

export async function listCustomers(businessId: string, q?: string) {
  return prisma.customer.findMany({
    where: {
      businessId,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { waId: { contains: q } },
              { notes: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      addresses: { orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] },
      _count: { select: { orders: true } },
    },
    orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
  });
}

export async function getCustomer(businessId: string, customerId: string) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, businessId },
    include: {
      addresses: { orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] },
      orders: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
          total: true,
          createdAt: true,
        },
      },
      _count: { select: { orders: true } },
    },
  });

  if (!customer) {
    throw new AppError(404, "Customer not found", "NOT_FOUND");
  }

  return {
    ...customer,
    orders: customer.orders.map((o) => ({
      ...o,
      total: Number(o.total),
    })),
  };
}

export async function createCustomer(
  businessId: string,
  actorUserId: string,
  input: CreateCustomerInput,
) {
  const waId = normalizeWaId(input.waId);
  const existing = await prisma.customer.findFirst({
    where: { businessId, waId },
  });
  if (existing) {
    throw new AppError(409, "Customer already exists", "CUSTOMER_EXISTS");
  }

  const customer = await prisma.customer.create({
    data: {
      businessId,
      waId,
      name: input.name ?? null,
      notes: input.notes ?? null,
      addresses: input.address
        ? {
            create: {
              businessId,
              line1: input.address.line1,
              landmark: input.address.landmark ?? null,
              city: input.address.city ?? null,
              isDefault: input.address.isDefault ?? true,
            },
          }
        : undefined,
    },
    include: {
      addresses: true,
      _count: { select: { orders: true } },
    },
  });

  await prisma.auditLog.create({
    data: {
      businessId,
      actorUserId,
      action: "CUSTOMER_CREATED",
      entity: "Customer",
      entityId: customer.id,
    },
  });

  return customer;
}

export async function updateCustomer(
  businessId: string,
  actorUserId: string,
  customerId: string,
  input: UpdateCustomerInput,
) {
  const existing = await prisma.customer.findFirst({
    where: { id: customerId, businessId },
  });
  if (!existing) {
    throw new AppError(404, "Customer not found", "NOT_FOUND");
  }

  const customer = await prisma.customer.update({
    where: { id: customerId },
    data: {
      name: input.name,
      notes: input.notes,
    },
    include: {
      addresses: true,
      _count: { select: { orders: true } },
    },
  });

  await prisma.auditLog.create({
    data: {
      businessId,
      actorUserId,
      action: "CUSTOMER_UPDATED",
      entity: "Customer",
      entityId: customerId,
      meta: input,
    },
  });

  return customer;
}

export async function addCustomerAddress(
  businessId: string,
  actorUserId: string,
  customerId: string,
  input: CreateCustomerAddressInput,
) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, businessId },
  });
  if (!customer) {
    throw new AppError(404, "Customer not found", "NOT_FOUND");
  }

  if (input.isDefault) {
    await prisma.customerAddress.updateMany({
      where: { businessId, customerId },
      data: { isDefault: false },
    });
  }

  const address = await prisma.customerAddress.create({
    data: {
      businessId,
      customerId,
      line1: input.line1,
      landmark: input.landmark ?? null,
      city: input.city ?? null,
      isDefault: input.isDefault ?? false,
    },
  });

  await prisma.auditLog.create({
    data: {
      businessId,
      actorUserId,
      action: "CUSTOMER_ADDRESS_ADDED",
      entity: "CustomerAddress",
      entityId: address.id,
      meta: { customerId },
    },
  });

  return address;
}

/** Upsert helper for WhatsApp intake (used later by webhook worker). */
export async function upsertCustomerByWaId(
  businessId: string,
  waId: string,
  name?: string | null,
) {
  const normalized = normalizeWaId(waId);
  return prisma.customer.upsert({
    where: {
      businessId_waId: { businessId, waId: normalized },
    },
    create: {
      businessId,
      waId: normalized,
      name: name ?? null,
      lastMessageAt: new Date(),
    },
    update: {
      name: name ?? undefined,
      lastMessageAt: new Date(),
    },
  });
}
