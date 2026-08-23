import {
  Alert,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Space,
  Table,
  Tag,
  message,
} from "antd";
import { useCallback, useEffect, useState } from "react";
import AppShell from "../components/AppShell";
import { useAuthSession } from "../hooks/useAuthSession";
import client from "../api/client";
import { stockColor } from "../lib/format";

export default function Inventory() {
  const { loading: authLoading, error: authError, businessName, token } =
    useAuthSession();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [setOpen, setSetOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [adjustForm] = Form.useForm();
  const [setForm] = Form.useForm();

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await client.get("/inventory");
      setRows(data);
    } catch (err) {
      setError(err.message || "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!authLoading && token) void load();
  }, [authLoading, token, load]);

  function openAdjust(row) {
    setSelected(row);
    adjustForm.resetFields();
    adjustForm.setFieldsValue({ delta: 1 });
    setAdjustOpen(true);
  }

  function openSet(row) {
    setSelected(row);
    setForm.resetFields();
    setForm.setFieldsValue({ quantity: row.quantityOnHand });
    setSetOpen(true);
  }

  async function onAdjust(values) {
    if (!token || !selected) return;
    setSaving(true);
    try {
      await client.post("/inventory/adjust", {
        productId: selected.productId,
        variantId: selected.variantId,
        delta: values.delta,
        note: values.note,
      });
      message.success("Stock adjusted");
      setAdjustOpen(false);
      await load();
    } catch (err) {
      message.error(err.message || "Adjust failed");
    } finally {
      setSaving(false);
    }
  }

  async function onSet(values) {
    if (!token || !selected) return;
    setSaving(true);
    try {
      await client.post("/inventory/set", {
        productId: selected.productId,
        variantId: selected.variantId,
        quantity: values.quantity,
        note: values.note,
      });
      message.success("Stock updated");
      setSetOpen(false);
      await load();
    } catch (err) {
      message.error(err.message || "Update failed");
    } finally {
      setSaving(false);
    }
  }

  if (authLoading) {
    return (
      <AppShell title="Inventory">
        <Alert type="info" message="Loading..." />
      </AppShell>
    );
  }

  return (
    <AppShell title="Inventory" businessName={businessName}>
      {(authError || error) && (
        <Alert
          type="error"
          message={authError || error}
          style={{ marginBottom: 16 }}
        />
      )}
      <Table
        rowKey="id"
        loading={loading}
        dataSource={rows}
        pagination={{ pageSize: 20 }}
        columns={[
          {
            title: "Product",
            key: "product",
            render: (_, row) =>
              row.variant
                ? `${row.product.name} · ${row.variant.name}`
                : row.product.name,
          },
          {
            title: "SKU",
            key: "sku",
            render: (_, row) => row.variant?.sku || "—",
          },
          {
            title: "On hand",
            dataIndex: "quantityOnHand",
            width: 100,
          },
          {
            title: "Status",
            dataIndex: "stockStatus",
            render: (status) => (
              <Tag color={stockColor(status)}>
                {status.replaceAll("_", " ")}
              </Tag>
            ),
          },
          {
            title: "Orderable",
            key: "orderable",
            render: (_, row) => {
              const available = row.variant
                ? row.variant.isAvailable
                : row.product.isAvailable;
              return available ? (
                <Tag color="green">Yes</Tag>
              ) : (
                <Tag color="red">No</Tag>
              );
            },
          },
          {
            title: "Actions",
            key: "actions",
            width: 200,
            render: (_, row) => (
              <Space>
                <Button size="small" onClick={() => openAdjust(row)}>
                  Adjust
                </Button>
                <Button size="small" onClick={() => openSet(row)}>
                  Set qty
                </Button>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title="Adjust stock"
        open={adjustOpen}
        onCancel={() => setAdjustOpen(false)}
        onOk={() => adjustForm.submit()}
        confirmLoading={saving}
        destroyOnClose
      >
        <Form form={adjustForm} layout="vertical" onFinish={onAdjust}>
          <Form.Item
            label="Change (+/-)"
            name="delta"
            rules={[{ required: true, message: "Delta is required" }]}
            extra="Use negative values to reduce stock."
          >
            <InputNumber style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item label="Note" name="note">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Set stock quantity"
        open={setOpen}
        onCancel={() => setSetOpen(false)}
        onOk={() => setForm.submit()}
        confirmLoading={saving}
        destroyOnClose
      >
        <Form form={setForm} layout="vertical" onFinish={onSet}>
          <Form.Item
            label="Quantity"
            name="quantity"
            rules={[{ required: true, message: "Quantity is required" }]}
          >
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item label="Note" name="note">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </AppShell>
  );
}
