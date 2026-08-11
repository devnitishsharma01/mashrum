import { prisma } from "@mashrum/database";
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
} from "@mashrum/shared";
import { AppError } from "../lib/errors";
import { slugify } from "../lib/slug";

async function uniqueCategorySlug(
  businessId: string,
  name: string,
  excludeId?: string,
): Promise<string> {
  const base = slugify(name) || "category";
  let slug = base;
  let i = 1;
  while (true) {
    const existing = await prisma.category.findFirst({
      where: {
        businessId,
        slug,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (!existing) return slug;
    i += 1;
    slug = `${base}-${i}`;
  }
}

export async function listCategories(businessId: string) {
  return prisma.category.findMany({
    where: { businessId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { products: true } },
    },
  });
}

export async function createCategory(
  businessId: string,
  actorUserId: string,
  input: CreateCategoryInput,
) {
  const slug = await uniqueCategorySlug(businessId, input.name);
  const category = await prisma.category.create({
    data: {
      businessId,
      name: input.name,
      slug,
      sortOrder: input.sortOrder ?? 0,
      isVisible: input.isVisible ?? true,
    },
  });

  await prisma.auditLog.create({
    data: {
      businessId,
      actorUserId,
      action: "CATEGORY_CREATED",
      entity: "Category",
      entityId: category.id,
    },
  });

  return category;
}

export async function updateCategory(
  businessId: string,
  actorUserId: string,
  categoryId: string,
  input: UpdateCategoryInput,
) {
  const existing = await prisma.category.findFirst({
    where: { id: categoryId, businessId },
  });
  if (!existing) {
    throw new AppError(404, "Category not found", "NOT_FOUND");
  }

  const slug =
    input.name && input.name !== existing.name
      ? await uniqueCategorySlug(businessId, input.name, categoryId)
      : undefined;

  const category = await prisma.category.update({
    where: { id: categoryId },
    data: {
      name: input.name,
      slug,
      sortOrder: input.sortOrder,
      isVisible: input.isVisible,
    },
  });

  await prisma.auditLog.create({
    data: {
      businessId,
      actorUserId,
      action: "CATEGORY_UPDATED",
      entity: "Category",
      entityId: category.id,
      meta: input,
    },
  });

  return category;
}

export async function deleteCategory(
  businessId: string,
  actorUserId: string,
  categoryId: string,
) {
  const existing = await prisma.category.findFirst({
    where: { id: categoryId, businessId },
    include: { _count: { select: { products: true } } },
  });
  if (!existing) {
    throw new AppError(404, "Category not found", "NOT_FOUND");
  }

  await prisma.category.delete({ where: { id: categoryId } });

  await prisma.auditLog.create({
    data: {
      businessId,
      actorUserId,
      action: "CATEGORY_DELETED",
      entity: "Category",
      entityId: categoryId,
      meta: { productCount: existing._count.products },
    },
  });

  return { success: true };
}
