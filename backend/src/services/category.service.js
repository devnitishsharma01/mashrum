"use strict";

const { docToObject, toId } = require("../db");
const { Category, Product, AuditLog } = require("../models");
const { AppError } = require("../lib/errors");
const { slugify } = require("../lib/slug");

async function uniqueCategorySlug(businessId, name, excludeId) {
  const base = slugify(name) || "category";
  let slug = base;
  let i = 1;
  while (true) {
    const query = { businessId: toId(businessId), slug };
    if (excludeId) query._id = { $ne: toId(excludeId) };
    const existing = await Category.findOne(query).select("_id").lean();
    if (!existing) return slug;
    i += 1;
    slug = `${base}-${i}`;
  }
}

async function listCategories(businessId) {
  const categories = await Category.find({ businessId: toId(businessId) })
    .sort({ sortOrder: 1, name: 1 })
    .lean();

  const counts = await Product.aggregate([
    { $match: { businessId: toId(businessId) } },
    { $group: { _id: "$categoryId", count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [c._id?.toString(), c.count]));

  return categories.map((c) => ({
    id: c._id.toString(),
    businessId: c.businessId.toString(),
    name: c.name,
    slug: c.slug,
    sortOrder: c.sortOrder,
    isVisible: c.isVisible,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    _count: { products: countMap.get(c._id.toString()) || 0 },
  }));
}

async function createCategory(businessId, actorUserId, input) {
  const slug = await uniqueCategorySlug(businessId, input.name);
  const categoryDoc = await Category.create({
    businessId: toId(businessId),
    name: input.name,
    slug,
    sortOrder: input.sortOrder ?? 0,
    isVisible: input.isVisible ?? true,
  });

  await AuditLog.create({
    businessId: toId(businessId),
    actorUserId: toId(actorUserId),
    action: "CATEGORY_CREATED",
    entity: "Category",
    entityId: categoryDoc._id,
  });

  return docToObject(categoryDoc);
}

async function updateCategory(businessId, actorUserId, categoryId, input) {
  const existing = await Category.findOne({
    _id: toId(categoryId),
    businessId: toId(businessId),
  });
  if (!existing) {
    throw new AppError(404, "Category not found", "NOT_FOUND");
  }

  if (input.name && input.name !== existing.name) {
    existing.slug = await uniqueCategorySlug(businessId, input.name, categoryId);
    existing.name = input.name;
  } else if (input.name) {
    existing.name = input.name;
  }
  if (input.sortOrder != null) existing.sortOrder = input.sortOrder;
  if (input.isVisible != null) existing.isVisible = input.isVisible;

  await existing.save();

  await AuditLog.create({
    businessId: toId(businessId),
    actorUserId: toId(actorUserId),
    action: "CATEGORY_UPDATED",
    entity: "Category",
    entityId: existing._id,
    meta: input,
  });

  return docToObject(existing);
}

async function deleteCategory(businessId, actorUserId, categoryId) {
  const existing = await Category.findOne({
    _id: toId(categoryId),
    businessId: toId(businessId),
  });
  if (!existing) {
    throw new AppError(404, "Category not found", "NOT_FOUND");
  }

  const productCount = await Product.countDocuments({
    categoryId: existing._id,
    businessId: toId(businessId),
  });

  await Category.deleteOne({ _id: existing._id });

  await AuditLog.create({
    businessId: toId(businessId),
    actorUserId: toId(actorUserId),
    action: "CATEGORY_DELETED",
    entity: "Category",
    entityId: existing._id,
    meta: { productCount },
  });

  return { success: true };
}

module.exports = {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};
