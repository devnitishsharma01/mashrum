"use client";

import { PlusOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  message,
} from "antd";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuthSession } from "@/hooks/useAuthSession";
import { api, type ApiError } from "@/lib/api";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: "OWNER" | "ADMIN" | "STAFF";
  isActive: boolean;
  createdAt: string;
};

export default function UsersPage() {
  const { loading: authLoading, error: authError, businessName, token, user } =
    useAuthSession();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const canWrite = user?.role === "OWNER";

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api<UserRow[]>("/users", { token });
      setRows(data);
    } catch (err) {
      setError((err as ApiError).message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!authLoading && token) void load();
  }, [authLoading, token, load]);

  async function onCreate(values: {
    name: string;
    email: string;
    password: string;
    role: "ADMIN" | "STAFF";
  }) {
    if (!token) return;
    setSaving(true);
    try {
      await api("/users", {
        method: "POST",
        token,
        body: JSON.stringify(values),
      });
      message.success("User created");
      setModalOpen(false);
      form.resetFields();
      await load();
    } catch (err) {
      message.error((err as ApiError).message || "Create failed");
    } finally {
      setSaving(false);
    }
  }

  async function onToggleActive(row: UserRow, isActive: boolean) {
    if (!token || !canWrite) return;
    try {
      await api(`/users/${row.id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ isActive }),
      });
      message.success("User updated");
      await load();
    } catch (err) {
      message.error((err as ApiError).message || "Update failed");
    }
  }

  async function onRoleChange(row: UserRow, role: UserRow["role"]) {
    if (!token || !canWrite) return;
    try {
      await api(`/users/${row.id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ role }),
      });
      message.success("Role updated");
      await load();
    } catch (err) {
      message.error((err as ApiError).message || "Update failed");
    }
  }

  return (
    <AppShell title="Users" businessName={businessName}>
      {(authError || error) && (
        <Alert
          type="error"
          message={authError || error}
          style={{ marginBottom: 16 }}
        />
      )}

      <Space style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          disabled={!canWrite}
          onClick={() => {
            form.resetFields();
            form.setFieldsValue({ role: "STAFF" });
            setModalOpen(true);
          }}
        >
          Add user
        </Button>
        {!canWrite ? (
          <Alert
            type="info"
            showIcon
            message="Only the business owner can add or change users."
          />
        ) : null}
      </Space>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={rows}
        pagination={false}
        columns={[
          { title: "Name", dataIndex: "name" },
          { title: "Email", dataIndex: "email" },
          {
            title: "Role",
            dataIndex: "role",
            render: (role: UserRow["role"], row) =>
              canWrite && row.role !== "OWNER" ? (
                <Select
                  size="small"
                  value={role}
                  style={{ width: 120 }}
                  options={[
                    { value: "ADMIN", label: "ADMIN" },
                    { value: "STAFF", label: "STAFF" },
                    { value: "OWNER", label: "OWNER" },
                  ]}
                  onChange={(v) => onRoleChange(row, v)}
                />
              ) : (
                <Tag color={role === "OWNER" ? "gold" : "blue"}>{role}</Tag>
              ),
          },
          {
            title: "Active",
            dataIndex: "isActive",
            render: (active: boolean, row) => (
              <Switch
                checked={active}
                disabled={!canWrite || row.id === user?.id}
                onChange={(v) => onToggleActive(row, v)}
              />
            ),
          },
        ]}
      />

      <Modal
        title="Add user"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saving}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={onCreate}>
          <Form.Item
            label="Name"
            name="name"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="Email"
            name="email"
            rules={[{ required: true, type: "email" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="Password"
            name="password"
            rules={[{ required: true, min: 8 }]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item
            label="Role"
            name="role"
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { value: "ADMIN", label: "Admin" },
                { value: "STAFF", label: "Staff" },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </AppShell>
  );
}
