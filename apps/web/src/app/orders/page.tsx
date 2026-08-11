"use client";

import { PlusOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Timeline,
  Typography,
  message,
} from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuthSession } from "@/hooks/useAuthSession";
import { api, type ApiError } from "@/lib/api";
import { formatMoney } from "@/lib/format";

type Customer = {
  id: string;
  name: string | null;
  waId: string;
};

type Product = {
  id: string;
  name: string;
  basePrice: number;
  isAvailable: boolean;
  quantityOnHand: number;
  variants: Array<{
    id: string;
    name: string;
    price: number;
    isAvailable: boolean;
    quantityOnHand: number;
  }>;
};

type OrderListItem = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  total: number;
  createdAt: string;
  customer: Customer;
  allowedTransitions: string[];
  _count: { items: number };
};

type OrderDetail = OrderListItem & {
  notes: string | null;
  subtotal: number;
  deliveryAddressSnapshot: {
    line1?: string;
    landmark?: string | null;
    city?: string | null;
  } | null;
  items: Array<{
    id: string;
    nameSnapshot: string;
    qty: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  timeline: Array<{
    id: string;
    fromStatus: string | null;
    toStatus: string;
    note: string | null;
    createdAt: string;
  }>;
  payment: {
    id: string;
    status: string;
    amount: number;
    method: string;
  } | null;
};

type KanbanData = {
  view: "kanban";
  columns: Record<string, OrderListItem[]>;
};

type ListData = {
  view: "list";
  orders: OrderListItem[];
};

const KANBAN_ORDER = [
  "NEW",
  "CONFIRMED",
  "PROCESSING",
  "READY",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
];

const STATUS_COLOR: Record<string, string> = {
  NEW: "blue",
  CONFIRMED: "cyan",
  PROCESSING: "geekblue",
  READY: "purple",
  OUT_FOR_DELIVERY: "orange",
  DELIVERED: "green",
  COMPLETED: "success",
  CANCELLED: "red",
  DELIVERY_FAILED: "volcano",
  RETURNED: "magenta",
  CUSTOMER_NOT_REACHABLE: "gold",
};

function statusLabel(status: string) {
  return status.replaceAll("_", " ");
}

export default function OrdersPage() {
  const { loading: authLoading, error: authError, businessName, token, currency } =
    useAuthSession();
  const [view, setView] = useState<"list" | "kanban">("kanban");
  const [listOrders, setListOrders] = useState<OrderListItem[]>([]);
  const [kanban, setKanban] = useState<Record<string, OrderListItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ view });
      if (q.trim()) params.set("q", q.trim());
      const data = await api<ListData | KanbanData>(
        `/orders?${params.toString()}`,
        { token },
      );
      if (data.view === "kanban") {
        setKanban(data.columns);
      } else {
        setListOrders(data.orders);
      }
    } catch (err) {
      setError((err as ApiError).message || "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, [token, view, q]);

  useEffect(() => {
    if (!authLoading && token) void load();
  }, [authLoading, token, load]);

  async function openDetail(orderId: string) {
    if (!token) return;
    try {
      const data = await api<OrderDetail>(`/orders/${orderId}`, { token });
      setDetail(data);
    } catch (err) {
      message.error((err as ApiError).message || "Failed to load order");
    }
  }

  async function transition(orderId: string, status: string) {
    if (!token) return;
    try {
      const data = await api<OrderDetail>(`/orders/${orderId}/transition`, {
        method: "POST",
        token,
        body: JSON.stringify({ status }),
      });
      message.success(`Moved to ${statusLabel(status)}`);
      setDetail(data);
      await load();
    } catch (err) {
      message.error((err as ApiError).message || "Transition failed");
    }
  }

  async function markPaid(orderId: string) {
    if (!token) return;
    try {
      const data = await api<OrderDetail>(`/orders/${orderId}/payment`, {
        method: "POST",
        token,
        body: JSON.stringify({ status: "COLLECTED" }),
      });
      message.success("Payment marked as collected");
      setDetail(data);
      await load();
    } catch (err) {
      message.error((err as ApiError).message || "Payment update failed");
    }
  }

  async function openCreate() {
    if (!token) return;
    try {
      const [customerData, productData] = await Promise.all([
        api<Customer[]>("/customers", { token }),
        api<Product[]>("/products", { token }),
      ]);
      setCustomers(customerData);
      setProducts(productData.filter((p) => p.isAvailable));
      form.resetFields();
      form.setFieldsValue({ items: [{ qty: 1 }] });
      setCreateOpen(true);
    } catch (err) {
      message.error((err as ApiError).message || "Failed to prepare form");
    }
  }

  async function onCreate(values: {
    customerId: string;
    notes?: string;
    items: Array<{ productId: string; variantId?: string; qty: number }>;
  }) {
    if (!token) return;
    setSaving(true);
    try {
      const data = await api<OrderDetail>("/orders", {
        method: "POST",
        token,
        body: JSON.stringify({
          customerId: values.customerId,
          notes: values.notes || null,
          items: values.items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId || null,
            qty: item.qty,
          })),
        }),
      });
      message.success(`Order ${data.orderNumber} created`);
      setCreateOpen(false);
      setDetail(data);
      await load();
    } catch (err) {
      message.error((err as ApiError).message || "Create failed");
    } finally {
      setSaving(false);
    }
  }

  const customerOptions = useMemo(
    () =>
      customers.map((c) => ({
        value: c.id,
        label: `${c.name || "Unnamed"} (${c.waId})`,
      })),
    [customers],
  );

  const productOptions = useMemo(
    () =>
      products.map((p) => ({
        value: p.id,
        label: `${p.name} · stock ${p.quantityOnHand}`,
      })),
    [products],
  );

  if (authLoading) {
    return (
      <AppShell title="Orders">
        <Alert type="info" message="Loading..." />
      </AppShell>
    );
  }

  return (
    <AppShell title="Orders" businessName={businessName}>
      {(authError || error) && (
        <Alert
          type="error"
          message={authError || error}
          style={{ marginBottom: 16 }}
        />
      )}

      <Space wrap style={{ marginBottom: 16 }}>
        <Segmented
          value={view}
          onChange={(v) => setView(v as "list" | "kanban")}
          options={[
            { label: "Kanban", value: "kanban" },
            { label: "List", value: "list" },
          ]}
        />
        <Input.Search
          placeholder="Search order, customer, phone"
          allowClear
          onSearch={setQ}
          style={{ width: 280 }}
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Create order
        </Button>
      </Space>

      {view === "list" ? (
        <Table
          rowKey="id"
          loading={loading}
          dataSource={listOrders}
          pagination={{ pageSize: 20 }}
          columns={[
            {
              title: "Order",
              dataIndex: "orderNumber",
              render: (v: string, row) => (
                <Button type="link" style={{ padding: 0 }} onClick={() => openDetail(row.id)}>
                  {v}
                </Button>
              ),
            },
            {
              title: "Customer",
              key: "customer",
              render: (_, row) =>
                `${row.customer.name || "Unnamed"} · ${row.customer.waId}`,
            },
            {
              title: "Amount",
              dataIndex: "total",
              render: (v: number) => formatMoney(v, currency),
            },
            {
              title: "Payment",
              dataIndex: "paymentStatus",
              render: (v: string) => <Tag>{statusLabel(v)}</Tag>,
            },
            {
              title: "Status",
              dataIndex: "status",
              render: (v: string) => (
                <Tag color={STATUS_COLOR[v] || "default"}>{statusLabel(v)}</Tag>
              ),
            },
          ]}
        />
      ) : (
        <div
          style={{
            display: "flex",
            gap: 12,
            overflowX: "auto",
            paddingBottom: 8,
            minHeight: 420,
          }}
        >
          {KANBAN_ORDER.map((status) => (
            <div
              key={status}
              style={{
                minWidth: 260,
                maxWidth: 280,
                background: "#e8efe9",
                borderRadius: 12,
                padding: 10,
              }}
            >
              <Typography.Text strong>
                {statusLabel(status)} ({kanban[status]?.length || 0})
              </Typography.Text>
              <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                {(kanban[status] || []).map((order) => (
                  <Card
                    key={order.id}
                    size="small"
                    hoverable
                    onClick={() => openDetail(order.id)}
                    styles={{ body: { padding: 12 } }}
                  >
                    <Typography.Text strong>{order.orderNumber}</Typography.Text>
                    <div style={{ color: "#5b6b63", fontSize: 12, marginTop: 4 }}>
                      {order.customer.name || "Unnamed"}
                      <br />
                      {formatMoney(order.total, currency)} ·{" "}
                      {statusLabel(order.paymentStatus)}
                    </div>
                  </Card>
                ))}
                {!loading && (kanban[status] || []).length === 0 ? (
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    No orders
                  </Typography.Text>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      <Drawer
        title={detail ? `Order ${detail.orderNumber}` : "Order"}
        open={!!detail}
        onClose={() => setDetail(null)}
        width={520}
      >
        {detail ? (
          <>
            <Space wrap style={{ marginBottom: 12 }}>
              <Tag color={STATUS_COLOR[detail.status]}>
                {statusLabel(detail.status)}
              </Tag>
              <Tag>{statusLabel(detail.paymentStatus)}</Tag>
            </Space>
            <Typography.Paragraph>
              Customer: {detail.customer.name || "Unnamed"} ({detail.customer.waId})
              <br />
              Total: {formatMoney(detail.total, currency)}
              <br />
              Address:{" "}
              {detail.deliveryAddressSnapshot
                ? `${detail.deliveryAddressSnapshot.line1 || ""}${
                    detail.deliveryAddressSnapshot.city
                      ? `, ${detail.deliveryAddressSnapshot.city}`
                      : ""
                  }`
                : "—"}
            </Typography.Paragraph>

            <Typography.Title level={5}>Items</Typography.Title>
            <Table
              size="small"
              rowKey="id"
              pagination={false}
              dataSource={detail.items}
              columns={[
                { title: "Item", dataIndex: "nameSnapshot" },
                { title: "Qty", dataIndex: "qty", width: 60 },
                {
                  title: "Total",
                  dataIndex: "lineTotal",
                  render: (v: number) => formatMoney(v, currency),
                },
              ]}
            />

            <Typography.Title level={5} style={{ marginTop: 16 }}>
              Actions
            </Typography.Title>
            <Space wrap>
              {detail.allowedTransitions.map((status) => (
                <Button
                  key={status}
                  onClick={() => transition(detail.id, status)}
                  danger={status === "CANCELLED"}
                >
                  {statusLabel(status)}
                </Button>
              ))}
              {detail.paymentStatus === "PENDING" &&
              detail.status !== "CANCELLED" ? (
                <Button type="primary" onClick={() => markPaid(detail.id)}>
                  Mark COD collected
                </Button>
              ) : null}
            </Space>

            <Typography.Title level={5} style={{ marginTop: 16 }}>
              Timeline
            </Typography.Title>
            <Timeline
              items={detail.timeline.map((event) => ({
                children: (
                  <>
                    <div>
                      {event.fromStatus
                        ? `${statusLabel(event.fromStatus)} → `
                        : ""}
                      {statusLabel(event.toStatus)}
                    </div>
                    {event.note ? (
                      <Typography.Text type="secondary">
                        {event.note}
                      </Typography.Text>
                    ) : null}
                  </>
                ),
              }))}
            />
          </>
        ) : null}
      </Drawer>

      <Modal
        title="Create order"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saving}
        destroyOnClose
        width={640}
      >
        <Form form={form} layout="vertical" onFinish={onCreate}>
          <Form.Item
            label="Customer"
            name="customerId"
            rules={[{ required: true, message: "Select a customer" }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              options={customerOptions}
            />
          </Form.Item>
          <Form.Item label="Notes" name="notes">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.List name="items">
            {(fields, { add, remove }) => (
              <>
                {fields.map((field) => (
                  <Space
                    key={field.key}
                    align="start"
                    style={{ display: "flex", marginBottom: 8 }}
                    wrap
                  >
                    <Form.Item
                      {...field}
                      name={[field.name, "productId"]}
                      rules={[{ required: true, message: "Product required" }]}
                      style={{ minWidth: 220 }}
                    >
                      <Select
                        placeholder="Product"
                        options={productOptions}
                        onChange={() => {
                          form.setFieldValue(
                            ["items", field.name, "variantId"],
                            undefined,
                          );
                        }}
                      />
                    </Form.Item>
                    <Form.Item
                      shouldUpdate
                      style={{ minWidth: 160, marginBottom: 0 }}
                    >
                      {() => {
                        const productId = form.getFieldValue([
                          "items",
                          field.name,
                          "productId",
                        ]) as string | undefined;
                        const product = products.find((p) => p.id === productId);
                        const variants = product?.variants || [];
                        return (
                          <Form.Item
                            {...field}
                            name={[field.name, "variantId"]}
                            style={{ marginBottom: 0 }}
                          >
                            <Select
                              allowClear
                              placeholder="Variant"
                              disabled={variants.length === 0}
                              options={variants.map((v) => ({
                                value: v.id,
                                label: `${v.name} · ${v.quantityOnHand}`,
                              }))}
                            />
                          </Form.Item>
                        );
                      }}
                    </Form.Item>
                    <Form.Item
                      {...field}
                      name={[field.name, "qty"]}
                      rules={[{ required: true, message: "Qty required" }]}
                    >
                      <InputNumber min={1} placeholder="Qty" />
                    </Form.Item>
                    {fields.length > 1 ? (
                      <Button danger onClick={() => remove(field.name)}>
                        Remove
                      </Button>
                    ) : null}
                  </Space>
                ))}
                <Button type="dashed" onClick={() => add({ qty: 1 })} block>
                  Add item
                </Button>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>
    </AppShell>
  );
}
