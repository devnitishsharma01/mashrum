import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_WORKING_HOURS = {
  monday: { open: "09:00", close: "21:00", closed: false },
  tuesday: { open: "09:00", close: "21:00", closed: false },
  wednesday: { open: "09:00", close: "21:00", closed: false },
  thursday: { open: "09:00", close: "21:00", closed: false },
  friday: { open: "09:00", close: "21:00", closed: false },
  saturday: { open: "09:00", close: "21:00", closed: false },
  sunday: { open: "10:00", close: "18:00", closed: true },
};

async function main() {
  const email = "demo@mashrum.app";
  const existing = await prisma.user.findFirst({ where: { email } });
  if (existing) {
    console.log("Seed skipped: demo user already exists (", email, ")");
    console.log("Login: demo@mashrum.app / demo12345");
    return;
  }

  const passwordHash = await bcrypt.hash("demo12345", 12);

  const business = await prisma.business.create({
    data: {
      name: "Demo Kirana Store",
      slug: "demo-kirana-store",
      timezone: "Asia/Kolkata",
      currency: "INR",
      phone: "+919999000111",
      address: "Sector 18, Noida",
      codEnabled: true,
      workingHours: DEFAULT_WORKING_HOURS,
      users: {
        create: {
          email,
          name: "Demo Owner",
          role: "OWNER",
          passwordHash,
        },
      },
      messageTemplates: {
        create: [
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
        ],
      },
      automationRules: {
        create: [
          { event: "CUSTOMER_FIRST_MESSAGE", templateKey: "WELCOME" },
          { event: "ORDER_CONFIRMED", templateKey: "ORDER_CONFIRMED" },
          { event: "ORDER_STATUS_CHANGED", templateKey: "ORDER_STATUS" },
        ],
      },
    },
  });

  const groceries = await prisma.category.create({
    data: {
      businessId: business.id,
      name: "Groceries",
      slug: "groceries",
      sortOrder: 1,
      isVisible: true,
    },
  });

  const beverages = await prisma.category.create({
    data: {
      businessId: business.id,
      name: "Beverages",
      slug: "beverages",
      sortOrder: 2,
      isVisible: true,
    },
  });

  const rice = await prisma.product.create({
    data: {
      businessId: business.id,
      categoryId: groceries.id,
      name: "Rice",
      description: "Premium steamed rice",
      basePrice: 350,
      isAvailable: true,
      isVisible: true,
      variants: {
        create: [
          {
            businessId: business.id,
            name: "1kg",
            sku: "RICE-1KG",
            price: 80,
            isAvailable: true,
          },
          {
            businessId: business.id,
            name: "5kg",
            sku: "RICE-5KG",
            price: 350,
            isAvailable: true,
          },
        ],
      },
    },
    include: { variants: true },
  });

  const milk = await prisma.product.create({
    data: {
      businessId: business.id,
      categoryId: groceries.id,
      name: "Milk",
      description: "Fresh toned milk",
      basePrice: 60,
      isAvailable: true,
      isVisible: true,
    },
  });

  const chai = await prisma.product.create({
    data: {
      businessId: business.id,
      categoryId: beverages.id,
      name: "Masala Chai",
      description: "Ready-to-brew chai blend",
      basePrice: 120,
      isAvailable: true,
      isVisible: true,
    },
  });

  await prisma.inventory.createMany({
    data: [
      {
        businessId: business.id,
        productId: rice.id,
        variantId: null,
        quantityOnHand: 0,
      },
      {
        businessId: business.id,
        productId: rice.id,
        variantId: rice.variants[0].id,
        quantityOnHand: 40,
      },
      {
        businessId: business.id,
        productId: rice.id,
        variantId: rice.variants[1].id,
        quantityOnHand: 25,
      },
      {
        businessId: business.id,
        productId: milk.id,
        variantId: null,
        quantityOnHand: 30,
      },
      {
        businessId: business.id,
        productId: chai.id,
        variantId: null,
        quantityOnHand: 18,
      },
    ],
  });

  await prisma.customer.create({
    data: {
      businessId: business.id,
      waId: "919810001111",
      name: "Sample Customer",
      addresses: {
        create: {
          businessId: business.id,
          line1: "House 11, Block A",
          city: "Noida",
          isDefault: true,
        },
      },
    },
  });

  console.log("Seed complete.");
  console.log("Business:", business.name, `(${business.slug})`);
  console.log("Login: demo@mashrum.app / demo12345");
  console.log("Products: Rice (variants), Milk, Masala Chai");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
