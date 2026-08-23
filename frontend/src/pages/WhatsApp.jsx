import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Space,
  Tag,
  Typography,
  message,
} from "antd";
import { useCallback, useEffect, useState } from "react";
import AppShell from "../components/AppShell";
import { useAuthSession } from "../hooks/useAuthSession";
import client from "../api/client";

export default function WhatsApp() {
  const { loading: authLoading, error: authError, businessName, token } =
    useAuthSession();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [error, setError] = useState(null);
  const [form] = Form.useForm();
  const [simForm] = Form.useForm();

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await client.get("/whatsapp/status");
      setStatus(data);
    } catch (err) {
      setError(err.message || "Failed to load WhatsApp status");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!authLoading && token) void load();
  }, [authLoading, token, load]);

  async function onConnect(values) {
    if (!token) return;
    setSaving(true);
    try {
      await client.post("/whatsapp/connect", values);
      message.success("WhatsApp connected");
      form.resetFields(["accessToken", "webhookVerifyToken"]);
      await load();
    } catch (err) {
      message.error(err.message || "Connect failed");
    } finally {
      setSaving(false);
    }
  }

  async function onDisconnect() {
    if (!token) return;
    setSaving(true);
    try {
      await client.post("/whatsapp/disconnect");
      message.success("WhatsApp disconnected");
      await load();
    } catch (err) {
      message.error(err.message || "Disconnect failed");
    } finally {
      setSaving(false);
    }
  }

  async function onSimulate(values) {
    if (!token) return;
    setSimulating(true);
    try {
      await client.post("/whatsapp/simulate", values);
      message.success("Inbound message processed (check API logs for replies)");
    } catch (err) {
      message.error(err.message || "Simulate failed");
    } finally {
      setSimulating(false);
    }
  }

  if (authLoading || loading) {
    return (
      <AppShell title="WhatsApp">
        <Alert type="info" message="Loading..." />
      </AppShell>
    );
  }

  return (
    <AppShell title="WhatsApp" businessName={businessName}>
      {(authError || error) && (
        <Alert
          type="error"
          message={authError || error}
          style={{ marginBottom: 16 }}
        />
      )}

      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Card title="Connection">
          <Space style={{ marginBottom: 12 }}>
            <Tag color={status?.connected ? "green" : "default"}>
              {status?.account?.status || "DISCONNECTED"}
            </Tag>
            {status?.mockSend ? <Tag color="gold">Mock send ON</Tag> : null}
          </Space>
          <Typography.Paragraph type="secondary">
            Webhook URL (set this in Meta Developer Console):
            <br />
            <Typography.Text code copyable>
              {status?.webhookUrl}
            </Typography.Text>
          </Typography.Paragraph>
          {status?.account ? (
            <Typography.Paragraph>
              Phone number ID: {status.account.phoneNumberId}
              <br />
              Display phone: {status.account.displayPhone || "—"}
              {status.account.lastError ? (
                <>
                  <br />
                  <Typography.Text type="danger">
                    Last error: {status.account.lastError}
                  </Typography.Text>
                </>
              ) : null}
            </Typography.Paragraph>
          ) : (
            <Typography.Paragraph type="secondary">
              Connect your Meta WhatsApp Cloud API phone number to start
              receiving orders.
            </Typography.Paragraph>
          )}

          <Form
            form={form}
            layout="vertical"
            onFinish={onConnect}
            style={{ maxWidth: 560 }}
          >
            <Form.Item
              label="Phone number ID"
              name="phoneNumberId"
              rules={[{ required: true }]}
              initialValue={status?.account?.phoneNumberId}
            >
              <Input />
            </Form.Item>
            <Form.Item label="Display phone" name="displayPhone">
              <Input placeholder="+91..." />
            </Form.Item>
            <Form.Item label="WABA ID" name="wabaId">
              <Input />
            </Form.Item>
            <Form.Item
              label="Access token"
              name="accessToken"
              rules={[{ required: true }]}
            >
              <Input.Password />
            </Form.Item>
            <Form.Item
              label="Webhook verify token"
              name="webhookVerifyToken"
              rules={[{ required: true, min: 8 }]}
              extra="Use the same token in Meta webhook configuration."
            >
              <Input.Password />
            </Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={saving}>
                {status?.connected ? "Update connection" : "Connect"}
              </Button>
              {status?.connected ? (
                <Button danger loading={saving} onClick={onDisconnect}>
                  Disconnect
                </Button>
              ) : null}
            </Space>
          </Form>
        </Card>

        <Card title="Local simulator">
          <Typography.Paragraph type="secondary">
            Test the ordering bot without Meta. Replies are printed in the API
            console when mock send is enabled.
          </Typography.Paragraph>
          <Form
            form={simForm}
            layout="vertical"
            onFinish={onSimulate}
            style={{ maxWidth: 560 }}
            initialValues={{
              from: "919811122233",
              text: "hi",
              contactName: "Rahul",
            }}
          >
            <Form.Item
              label="Customer WhatsApp number"
              name="from"
              rules={[{ required: true }]}
            >
              <Input />
            </Form.Item>
            <Form.Item label="Contact name" name="contactName">
              <Input />
            </Form.Item>
            <Form.Item
              label="Message"
              name="text"
              rules={[{ required: true }]}
              extra="Try: hi → 1 → 1 → 1 → checkout → address → confirm"
            >
              <Input.TextArea rows={3} />
            </Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={simulating}
              disabled={!status?.connected}
            >
              Send simulated inbound
            </Button>
          </Form>
        </Card>
      </Space>
    </AppShell>
  );
}
