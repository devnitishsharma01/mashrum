import {
  Alert,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Space,
  Switch,
  Table,
  Tag,
  message,
} from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useCallback, useEffect, useState } from "react";
import AppShell from "../components/AppShell";
import { useAuthSession } from "../hooks/useAuthSession";
import client from "../api/client";

export default function Categories() {
  const { loading: authLoading, error: authError, businessName, token } =
    useAuthSession();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await client.get("/categories");
      setRows(data);
    } catch (err) {
      setError(err.message || "Failed to load categories");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!authLoading && token) void load();
  }, [authLoading, token, load]);

  function openCreate() {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ isVisible: true, sortOrder: 0 });
    setModalOpen(true);
  }

  function openEdit(row) {
    setEditing(row);
    form.setFieldsValue({
      name: row.name,
      sortOrder: row.sortOrder,
      isVisible: row.isVisible,
    });
    setModalOpen(true);
  }

  async function onSave(values) {
    if (!token) return;
    setSaving(true);
    try {
      if (editing) {
        await client.patch(`/categories/${editing.id}`, values);
        message.success("Category updated");
      } else {
        await client.post("/categories", values);
        message.success("Category created");
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      message.error(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(row) {
    if (!token) return;
    Modal.confirm({
      title: `Delete category "${row.name}"?`,
      content: "Products in this category will become uncategorized.",
      okType: "danger",
      onOk: async () => {
        try {
          await client.delete(`/categories/${row.id}`);
          message.success("Category deleted");
          await load();
        } catch (err) {
          message.error(err.message || "Delete failed");
        }
      },
    });
  }

  if (authLoading) {
    return (
      <AppShell title="Categories">
        <Alert type="info" message="Loading..." />
      </AppShell>
    );
  }

  return (
    <AppShell title="Categories" businessName={businessName}>
      {(authError || error) && (
        <Alert
          type="error"
          message={authError || error}
          style={{ marginBottom: 16 }}
        />
      )}
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Add category
        </Button>
      </Space>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={rows}
        pagination={{ pageSize: 20 }}
        columns={[
          { title: "Name", dataIndex: "name" },
          { title: "Slug", dataIndex: "slug" },
          { title: "Sort", dataIndex: "sortOrder", width: 90 },
          {
            title: "Products",
            dataIndex: ["_count", "products"],
            width: 110,
          },
          {
            title: "Visible",
            dataIndex: "isVisible",
            width: 100,
            render: (v) =>
              v ? <Tag color="green">Yes</Tag> : <Tag>No</Tag>,
          },
          {
            title: "Actions",
            key: "actions",
            width: 160,
            render: (_, row) => (
              <Space>
                <Button size="small" onClick={() => openEdit(row)}>
                  Edit
                </Button>
                <Button size="small" danger onClick={() => onDelete(row)}>
                  Delete
                </Button>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={editing ? "Edit category" : "Add category"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saving}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={onSave}>
          <Form.Item
            label="Name"
            name="name"
            rules={[{ required: true, message: "Name is required" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item label="Sort order" name="sortOrder">
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item label="Visible" name="isVisible" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </AppShell>
  );
}
