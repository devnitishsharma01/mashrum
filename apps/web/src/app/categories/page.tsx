"use client";

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
import { AppShell } from "@/components/AppShell";
import { useAuthSession } from "@/hooks/useAuthSession";
import { api, type ApiError } from "@/lib/api";

type Category = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  isVisible: boolean;
  _count: { products: number };
};

export default function CategoriesPage() {
  const { loading: authLoading, error: authError, businessName, token } =
    useAuthSession();
  const [rows, setRows] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api<Category[]>("/categories", { token });
      setRows(data);
    } catch (err) {
      setError((err as ApiError).message || "Failed to load categories");
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

  function openEdit(row: Category) {
    setEditing(row);
    form.setFieldsValue({
      name: row.name,
      sortOrder: row.sortOrder,
      isVisible: row.isVisible,
    });
    setModalOpen(true);
  }

  async function onSave(values: {
    name: string;
    sortOrder: number;
    isVisible: boolean;
  }) {
    if (!token) return;
    setSaving(true);
    try {
      if (editing) {
        await api(`/categories/${editing.id}`, {
          method: "PATCH",
          token,
          body: JSON.stringify(values),
        });
        message.success("Category updated");
      } else {
        await api("/categories", {
          method: "POST",
          token,
          body: JSON.stringify(values),
        });
        message.success("Category created");
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      message.error((err as ApiError).message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(row: Category) {
    if (!token) return;
    Modal.confirm({
      title: `Delete category "${row.name}"?`,
      content: "Products in this category will become uncategorized.",
      okType: "danger",
      onOk: async () => {
        try {
          await api(`/categories/${row.id}`, { method: "DELETE", token });
          message.success("Category deleted");
          await load();
        } catch (err) {
          message.error((err as ApiError).message || "Delete failed");
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
            render: (v: boolean) =>
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
