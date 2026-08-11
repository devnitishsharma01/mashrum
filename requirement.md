# SOFTWARE REQUIREMENTS SPECIFICATION

## WhatsApp Order & Inventory Management System

### 1. Project Objective

The objective of this system is to allow a business to:

1. Show its products on WhatsApp Shop.
2. Receive customer orders through WhatsApp.
3. Automatically show those orders in an Admin Panel.
4. Manage the order from the Admin Panel.
5. Confirm the order.
6. Deliver the order.
7. Record/collect payment.
8. Manage products and inventory.

The customer does **not** need a separate application.

---

# 2. Simple Business Flow

```text
             CUSTOMER
                 |
                 ↓
          WhatsApp Shop
                 |
                 ↓
        Select Product
                 |
                 ↓
          Place Order
                 |
                 ↓
          ADMIN PANEL
                 |
        ┌────────┴────────┐
        ↓                 ↓
   Order Details      Customer Details
        |
        ↓
      Confirm
        |
        ↓
      Deliver
        |
        ↓
     Payment
        |
        ↓
      Complete
```

---

# 3. Main Modules

The system will contain only the following major modules:

### Admin Panel

- Dashboard
- Orders
- Products
- Inventory
- Customers
- WhatsApp Shop/Product Sync
- Basic Settings

---

# 4. WhatsApp Shop

The business will maintain its products in the Admin Panel.

Example:

```text
Products

Product          Price       Stock

Milk             ₹60         25
Bread            ₹40         15
Rice 5kg         ₹350        10
Sugar 1kg        ₹50         20
```

The available products should be displayed in the business's WhatsApp Shop/catalog.

The business should be able to:

- Add product
- Edit product
- Delete product
- Add product image
- Add price
- Add quantity/stock
- Enable/disable product

Only active products should be shown to customers.

---

# 5. Product Management

Admin should be able to add products.

### Product Information

- Product Name
- Product Image
- Description
- Price
- SKU (optional)
- Quantity/Stock
- Product Status

Example:

```text
Product Name: Rice
Price: ₹350
Quantity: 20
Status: Active
```

When the product is active, it can be displayed in WhatsApp Shop.

---

# 6. Inventory Management

The admin should be able to manage available product quantities.

Example:

```text
Rice
Current Stock: 20

Customer orders 2

Remaining Stock: 18
```

The system should update stock when an order is confirmed.

### Inventory Status

```text
Available
Low Stock
Out of Stock
```

If quantity becomes `0`, the product should automatically become unavailable for ordering.

---

# 7. WhatsApp Orders

When a customer places an order through WhatsApp, the order should be received by the system.

Example:

```text
Order #ORD-1001

Customer:
Rahul Sharma

Phone:
98XXXXXXXX

Products:
Rice 5kg × 2
Sugar 1kg × 1

Total:
₹750

Address:
Ghaziabad, UP

Payment:
Cash on Delivery
```

The order should automatically appear in the Admin Panel.

---

# 8. Admin Order Management

The Admin Panel should show all WhatsApp orders.

### Order List

| Order ID | Customer | Amount | Payment | Status |
|---|---|---:|---|---|
| ORD-1001 | Rahul | ₹750 | Pending | New |
| ORD-1002 | Amit | ₹450 | Paid | Confirmed |
| ORD-1003 | Ravi | ₹900 | Pending | Delivered |

Admin can open an order to view complete details.

---

# 9. Order Status

The order lifecycle should be simple.

```text
New
 ↓
Confirmed
 ↓
Preparing
 ↓
Out for Delivery
 ↓
Delivered
 ↓
Payment Collected
 ↓
Completed
```

If required, the admin should also be able to cancel an order.

```text
New → Cancelled
Confirmed → Cancelled
```

---

# 10. Order Confirmation

When a new order is received:

```text
NEW ORDER
     ↓
Admin checks order
     ↓
Admin confirms order
     ↓
Order status = Confirmed
```

After confirmation, the customer can receive a WhatsApp confirmation message.

Example:

> Your order #ORD-1001 has been confirmed.

---

# 11. Delivery Management

After confirmation, the admin/business will process the order.

Example:

```text
Confirmed
     ↓
Preparing
     ↓
Out for Delivery
     ↓
Delivered
```

Admin can update the order status from the Admin Panel.

---

# 12. Payment Management

The system should allow the admin to record payment status.

### Payment Status

```text
Pending
Paid
```

Example:

```text
Order Total: ₹750

Payment:
Pending
```

After receiving payment:

```text
Payment:
Paid
```

For the initial version, payment can be handled as a manual status update by the admin.

Example:

**[Mark as Paid]**

Online payment gateway integration can be added later if required.

---

# 13. Customer Information

When an order is received, the system should store basic customer information.

Required information:

- Customer Name
- WhatsApp Number
- Phone Number
- Delivery Address
- City
- Pincode

The customer should be identifiable through the WhatsApp phone number.

---

# 14. Customer Order History

Admin should be able to see previous orders from a customer.

Example:

```text
Customer: Rahul Sharma
Phone: 98XXXXXXXX

Total Orders: 8

Orders:
ORD-1001 - ₹750
ORD-0987 - ₹450
ORD-0954 - ₹900
```

This is only basic customer history; advanced CRM is not part of the requirement.

---

# 15. Product Availability

Admin should have control over whether products are visible in WhatsApp Shop.

### Active

Product is visible and orderable.

### Inactive

Product is hidden from customers.

### Out of Stock

Product is unavailable for ordering.

Example:

```text
Rice
Stock: 0
Status: Out of Stock
```

The product should not be available for new orders.

---

# 16. Admin Dashboard

The dashboard should provide basic information.

Example:

```text
Today's Orders        25
Pending Orders         5
Confirmed Orders      10
Delivered Orders       8
Pending Payments       4
Today's Sales       ₹12,500
```

The dashboard is intended for quick business monitoring, not advanced analytics.

---

# 17. Search & Filter

Admin should be able to search orders by:

- Order ID
- Customer Name
- Phone Number

Basic filters:

- Order Status
- Payment Status
- Date

---

# 18. WhatsApp Integration

The system will integrate with the **Meta WhatsApp Business Platform / WhatsApp Cloud API**.

Basic integration flow:

```text
Customer
   ↓
WhatsApp
   ↓
Meta WhatsApp API
   ↓
Webhook
   ↓
Backend
   ↓
Order Created
   ↓
Admin Panel
```

The system will receive WhatsApp order information and create an order in the Admin Panel.

---

# 19. Basic Automated Messages

The system may send basic WhatsApp notifications.

### Order Received

> We have received your order #ORD-1001.

### Order Confirmed

> Your order #ORD-1001 has been confirmed.

### Out for Delivery

> Your order #ORD-1001 is out for delivery.

### Delivered

> Your order #ORD-1001 has been delivered.

These messages should be configurable if required.

---

# 20. Admin Panel Screens

The MVP will contain the following screens:

### 1. Login

Admin login.

### 2. Dashboard

Basic order, sales and payment summary.

### 3. Orders

View and manage all WhatsApp orders.

### 4. Order Details

View:

- Customer
- Products
- Quantity
- Amount
- Address
- Payment
- Status

### 5. Products

View all products.

### 6. Add/Edit Product

Manage:

- Product name
- Image
- Price
- Quantity
- Status

### 7. Inventory

View and update product stock.

### 8. Customers

View customers and their order history.

### 9. WhatsApp Settings

Manage WhatsApp connection/configuration.

---

# 21. MVP Scope

## Included

### WhatsApp

- WhatsApp Shop/Product Catalog
- Customer product browsing
- Customer order
- WhatsApp order receiving
- WhatsApp order notification

### Admin Panel

- Login
- Dashboard
- Order listing
- Order details
- Order confirmation
- Order status management
- Delivery status
- Payment status
- Customer details

### Product

- Add product
- Edit product
- Delete product
- Product image
- Product price
- Product quantity
- Product availability

### Inventory

- Stock management
- Stock update
- Out-of-stock handling
- Basic stock deduction after order confirmation

---

# 22. MVP Acceptance Criteria

The project will be considered successfully delivered when the following flow works:

### Product

Admin adds:

```text
Product
Price
Image
Quantity
```

↓

Product appears in WhatsApp Shop.

### Order

Customer selects product and places order on WhatsApp.

↓

Order appears in Admin Panel.

### Confirmation

Admin reviews the order.

↓

Admin confirms order.

↓

Customer receives confirmation.

### Delivery

Admin changes:

```text
Confirmed
→ Preparing
→ Out for Delivery
→ Delivered
```

### Payment

Admin records:

```text
Pending
→ Paid
```

### Inventory

When the order is confirmed:

```text
Available Stock
      ↓
Order Quantity Deducted
      ↓
Updated Stock
```

If stock becomes zero:

```text
Out of Stock
      ↓
Product unavailable on WhatsApp Shop
```

---

# 23. Final Client Understanding

In simple words, the system is:

> **A WhatsApp-based ordering system with an Admin Panel for managing orders, products, inventory, delivery and payment status.**

### Customer Side

**WhatsApp Shop**

→ See Products  
→ Select Product  
→ Place Order

### Business Side

**Admin Panel**

→ Receive Order  
→ Confirm Order  
→ Prepare Order  
→ Deliver Order  
→ Collect Payment  
→ Mark Paid  
→ Inventory Updated

### Main Objective

**“Customer orders on WhatsApp; business manages everything from the Admin Panel.”**