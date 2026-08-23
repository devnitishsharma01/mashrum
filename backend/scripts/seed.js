"use strict";

const bcrypt = require("bcryptjs");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const { connectDb, mongoose } = require("../src/db");
const { env } = require("../src/config/env");
const {
  Business,
  User,
  MessageTemplate,
  AutomationRule,
  Category,
  Product,
  ProductVariant,
  Inventory,
  Customer,
  CustomerAddress,
} = require("../src/models");

const DEFAULT_WORKING_HOURS = {
  monday: { open: "09:00", close: "21:00", closed: false },
  tuesday: { open: "09:00", close: "21:00", closed: false },
  wednesday: { open: "09:00", close: "21:00", closed: false },
  thursday: { open: "09:00", close: "21:00", closed: false },
  friday: { open: "09:00", close: "21:00", closed: false },
  saturday: { open: "09:00", close: "21:00", closed: false },
  sunday: { open: "10:00", close: "18:00", closed: true },
};

const MESSAGE_TEMPLATES = [
  {
    key: "WELCOME",
    name: "Welcome",
    body: "Welcome to {{business_name}}! Reply with *menu* to browse our catalog.",
  },
  {
    key: "ORDER_CONFIRMED",
    name: "Order Confirmed",
    body: "Your order {{order_number}} has been confirmed. We will update you shortly.",
  },
  {
    key: "ORDER_STATUS",
    name: "Order Status",
    body: "Order {{order_number}} status: {{status}}.",
  },
];

const AUTOMATION_RULES = [
  { event: "CUSTOMER_FIRST_MESSAGE", templateKey: "WELCOME" },
  { event: "ORDER_CONFIRMED", templateKey: "ORDER_CONFIRMED" },
  { event: "ORDER_STATUS_CHANGED", templateKey: "ORDER_STATUS" },
];

async function insertTemplatesAndRules(businessId) {
  await MessageTemplate.insertMany(
    MESSAGE_TEMPLATES.map((t) => ({
      businessId,
      key: t.key,
      name: t.name,
      body: t.body,
    })),
  );
  await AutomationRule.insertMany(
    AUTOMATION_RULES.map((r) => ({
      businessId,
      event: r.event,
      templateKey: r.templateKey,
    })),
  );
}

async function main() {
  await connectDb(env.MONGODB_URI);

  const email = "demo@mushroom.app";
  const existing = await User.findOne({ email }).select("_id").lean();
  if (existing) {
    console.log("Seed skipped: demo user already exists (", email, ")");
    console.log("Login: demo@mushroom.app / demo12345");
    return;
  }

  const passwordHash = await bcrypt.hash("demo12345", 12);

  const business = await Business.create({
    // name: "Demo Kirana Store",
    slug: "demo-kirana-store",
    timezone: "Asia/Kolkata",
    currency: "INR",
    phone: "+919999000111",
    address: "Sector 18, Noida",
    codEnabled: true,
    workingHours: DEFAULT_WORKING_HOURS,
  });

  await User.create({
    businessId: business._id,
    email,
    passwordHash,
    name: "Demo Owner",
    role: "OWNER",
  });

  await insertTemplatesAndRules(business._id);

  const groceries = await Category.create({
    businessId: business._id,
    name: "Groceries",
    slug: "groceries",
    sortOrder: 1,
    isVisible: true,
  });

  const beverages = await Category.create({
    businessId: business._id,
    name: "Beverages",
    slug: "beverages",
    sortOrder: 2,
    isVisible: true,
  });

  const rice = await Product.create({
    businessId: business._id,
    categoryId: groceries._id,
    name: "Rice",
    description: "Premium steamed rice",
    basePrice: 350,
    isAvailable: true,
    isVisible: true,
  });

  const riceVariant1 = await ProductVariant.create({
    businessId: business._id,
    productId: rice._id,
    name: "1kg",
    sku: "RICE-1KG",
    price: 80,
    isAvailable: true,
  });

  const riceVariant2 = await ProductVariant.create({
    businessId: business._id,
    productId: rice._id,
    name: "5kg",
    sku: "RICE-5KG",
    price: 350,
    isAvailable: true,
  });

  const milk = await Product.create({
    businessId: business._id,
    categoryId: groceries._id,
    name: "Milk",
    description: "Fresh toned milk",
    basePrice: 60,
    isAvailable: true,
    isVisible: true,
  });

  const chai = await Product.create({
    businessId: business._id,
    categoryId: beverages._id,
    name: "Masala Chai",
    description: "Ready-to-brew chai blend",
    basePrice: 120,
    isAvailable: true,
    isVisible: true,
  });

  await Inventory.insertMany([
    { businessId: business._id, productId: rice._id, variantId: null, quantityOnHand: 0 },
    { businessId: business._id, productId: rice._id, variantId: riceVariant1._id, quantityOnHand: 40 },
    { businessId: business._id, productId: rice._id, variantId: riceVariant2._id, quantityOnHand: 25 },
    { businessId: business._id, productId: milk._id, variantId: null, quantityOnHand: 30 },
    { businessId: business._id, productId: chai._id, variantId: null, quantityOnHand: 18 },
  ]);

  const customer = await Customer.create({
    businessId: business._id,
    waId: "919810001111",
    name: "Sample Customer",
  });

  await CustomerAddress.create({
    businessId: business._id,
    customerId: customer._id,
    line1: "House 11, Block A",
    city: "Noida",
    isDefault: true,
  });

  console.log("Seed complete.");
  console.log("Business:", business.name, `(${business.slug})`);
  console.log("Login: demo@mushroom.app / demo12345");
  console.log("Products: Rice (variants), Milk, Masala Chai");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
