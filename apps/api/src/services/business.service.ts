import { prisma } from "@mashrum/database";
import type { UpdateBusinessInput } from "@mashrum/shared";
import { AppError } from "../lib/errors";

export async function getBusiness(businessId: string) {
  const business = await prisma.business.findFirst({
    where: { id: businessId },
    select: {
      id: true,
      name: true,
      slug: true,
      timezone: true,
      currency: true,
      phone: true,
      address: true,
      status: true,
      codEnabled: true,
      workingHours: true,
      createdAt: true,
      updatedAt: true,
      whatsappAccount: {
        select: {
          id: true,
          displayPhone: true,
          phoneNumberId: true,
          status: true,
          connectedAt: true,
        },
      },
    },
  });

  if (!business) {
    throw new AppError(404, "Business not found", "NOT_FOUND");
  }

  return business;
}

export async function updateBusiness(
  businessId: string,
  actorUserId: string,
  input: UpdateBusinessInput,
) {
  const business = await prisma.business.update({
    where: { id: businessId },
    data: {
      name: input.name,
      timezone: input.timezone,
      currency: input.currency,
      phone: input.phone === undefined ? undefined : input.phone,
      address: input.address === undefined ? undefined : input.address,
      codEnabled: input.codEnabled,
      workingHours: input.workingHours,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      timezone: true,
      currency: true,
      phone: true,
      address: true,
      status: true,
      codEnabled: true,
      workingHours: true,
      updatedAt: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      businessId,
      actorUserId,
      action: "BUSINESS_UPDATED",
      entity: "Business",
      entityId: businessId,
      meta: input,
    },
  });

  return business;
}
