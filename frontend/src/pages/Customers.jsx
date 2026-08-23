import { PlusOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Drawer,
  Form,
  Input,
  Modal,
  Space,
  Table,
  Typography,
  message,
} from "antd";
import { useCallback, useEffect, useState } from "react";
import AppShell from "../components/AppShell";
import { useAuthSession } from "../hooks/useAuthSession";
import client from "../api/client";
import { formatMoney } from "../lib/format";

export default function Customers() {
  const { loading: authLoading, error: authError, businessName, token, currency } =
    useAuthSession();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [q, setQ] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState(null);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const params = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
      const data = await client.get(`/customers${params}`);
      setRows(data);
    } catch (err) {
      setError(err.message || "Failed to load customers");
    } finally {
      setLoading(false);
    }
  }, [token, q]);

  useEffect(() => {
    if (!authLoading && token) void load();
  }, [authLoading, token, load]);

  async function openDetail(id) {
    if (!token) return;
    try {
      const data = await client.get(`/customers/${id}`);
      setDetail(data);
    } catch (err) {
      message.error(err.message || "Failed to load customer");
    }
  }

  async function onCreate(values) {
    if (!token) return;
    setSaving(true);
    try {
      await client.post("/customers", {
        waId: values.waId,
        name: values.name || null,
        notes: values.notes || null,
        address: values.line1
          ? {
              line1: values.line1,
              city: values.city || null,
              isDefault: true,
            }
          : undefined,
      });
      message.success("Customer created");
      setModalOpen(false);
      form.resetFields();
      await load();
    } catch (err) {
      message.error(err.message || "Create failed");
    } finally {
      setSaving(false);
    }
  }

  if (authLoading) {
    return (
      <AppShell title="Customers">
        <Alert type="info" message="Loading..." />
      </AppShell>
    );
  }

  return (
    <AppShell title="Customers" businessName={businessName}>
      {(authError || error) && (
        <Alert
          type="error"
          message={authError || error}
          style={{ marginBottom: 16 }}
        />
      )}

      <Space wrap style={{ marginBottom: 16 }}>
        <Input.Search
          placeholder="Search name or WhatsApp"
          allowClear
          onSearch={setQ}
          style={{ width: 260 }}
        />
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            form.resetFields();
            setModalOpen(true);
          }}
        >
          Add customer
        </Button>
      </Space>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={rows}
        pagination={{ pageSize: 20 }}
        columns={[
          {
            title: "Name",
            dataIndex: "name",
            render: (name, row) => (
              <Button
                type="link"
                style={{ padding: 0 }}
                onClick={() => openDetail(row.id)}
              >
                {name || "Unnamed"}
              </Button>
            ),
          },
          { title: "WhatsApp", dataIndex: "waId" },
          {
            title: "Orders",
            dataIndex: ["_count", "orders"],
            width: 100,
          },
          {
            title: "Default address",
            key: "address",
            render: (_, row) => {
              const address =
                row.addresses.find((a) => a.isDefault) ?? row.addresses[0];
              return address
                ? `${address.line1}${address.city ? `, ${address.city}` : ""}`
                : "—";
            },
          },
        ]}
      />

      <Modal
        title="Add customer"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saving}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={onCreate}>
          <Form.Item
            label="WhatsApp number"
            name="waId"
            rules={[{ required: true, message: "WhatsApp number is required" }]}
          >
            <Input placeholder="+9198XXXXXXXX" />
          </Form.Item>
          <Form.Item label="Name" name="name">
            <Input />
          </Form.Item>
          <Form.Item label="Notes" name="notes">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item label="Address line" name="line1">
            <Input />
          </Form.Item>
          <Form.Item label="City" name="city">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title={detail?.name || detail?.waId || "Customer"}
        open={!!detail}
        onClose={() => setDetail(null)}
        width={480}
      >
        {detail ? (
          <>
            <Typography.Paragraph>
              WhatsApp: {detail.waId}
              <br />
              Total orders: {detail._count.orders}
            </Typography.Paragraph>
            {detail.notes ? (
              <Typography.Paragraph type="secondary">
                {detail.notes}
              </Typography.Paragraph>
            ) : null}
            <Typography.Title level={5}>Addresses</Typography.Title>
            {detail.addresses.length === 0 ? (
              <Typography.Text type="secondary">No addresses</Typography.Text>
            ) : (
              detail.addresses.map((a) => (
                <Typography.Paragraph key={a.id}>
                  {a.line1}
                  {a.city ? `, ${a.city}` : ""}
                  {a.isDefault ? " (default)" : ""}
                </Typography.Paragraph>
              ))
            )}
            <Typography.Title level={5}>Order history</Typography.Title>
            <Table
              size="small"
              rowKey="id"
              pagination={false}
              dataSource={detail.orders}
              locale={{ emptyText: "No orders yet" }}
              columns={[
                { title: "Order", dataIndex: "orderNumber" },
                { title: "Status", dataIndex: "status" },
                {
                  title: "Total",
                  dataIndex: "total",
                  render: (v) => formatMoney(v, currency),
                },
              ]}
            />
          </>
        ) : null}
      </Drawer>
    </AppShell>
  );
}
