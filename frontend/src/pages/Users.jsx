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
import AppShell from "../components/AppShell";
import { useAuthSession } from "../hooks/useAuthSession";
import client from "../api/client";

export default function Users() {
  const { loading: authLoading, error: authError, businessName, token, user } =
    useAuthSession();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const canWrite = user?.role === "OWNER";

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await client.get("/users");
      setRows(data);
    } catch (err) {
      setError(err.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!authLoading && token) void load();
  }, [authLoading, token, load]);

  async function onCreate(values) {
    if (!token) return;
    setSaving(true);
    try {
      await client.post("/users", values);
      message.success("User created");
      setModalOpen(false);
      form.resetFields();
      await load();
    } catch (err) {
      message.error(err.message || "Create failed");
    } finally {
      setSaving(false);
    }
  }

  async function onToggleActive(row, isActive) {
    if (!token || !canWrite) return;
    try {
      await client.patch(`/users/${row.id}`, { isActive });
      message.success("User updated");
      await load();
    } catch (err) {
      message.error(err.message || "Update failed");
    }
  }

  async function onRoleChange(row, role) {
    if (!token || !canWrite) return;
    try {
      await client.patch(`/users/${row.id}`, { role });
      message.success("Role updated");
      await load();
    } catch (err) {
      message.error(err.message || "Update failed");
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
            render: (role, row) =>
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
            render: (active, row) => (
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
