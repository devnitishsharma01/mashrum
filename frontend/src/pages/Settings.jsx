import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Space,
  Spin,
  Switch,
  TimePicker,
  Typography,
  message,
} from "antd";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import AppShell from "../components/AppShell";
import { useAuthSession } from "../hooks/useAuthSession";
import client from "../api/client";

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

export default function Settings() {
  const { loading: authLoading, error: authError, businessName, token } =
    useAuthSession();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState();
  const [error, setError] = useState(null);
  const [workingHours, setWorkingHours] = useState(null);

  useEffect(() => {
    if (authLoading || !token) return;
    client
      .get("/business/me")
      .then((business) => {
        setName(business.name);
        setWorkingHours(business.workingHours);
        form.setFieldsValue({
          name: business.name,
          phone: business.phone,
          address: business.address,
          timezone: business.timezone,
          currency: business.currency,
          codEnabled: business.codEnabled,
        });
      })
      .catch((err) => {
        setError(err.message || "Failed to load settings");
      })
      .finally(() => setLoading(false));
  }, [authLoading, token, form]);

  function updateDay(day, patch) {
    setWorkingHours((prev) => {
      if (!prev) return prev;
      return { ...prev, [day]: { ...prev[day], ...patch } };
    });
  }

  async function onFinish(values) {
    if (!token || !workingHours) return;
    setSaving(true);
    setError(null);
    try {
      const business = await client.patch("/business/me", {
        ...values,
        workingHours,
      });
      setName(business.name);
      setWorkingHours(business.workingHours);
      message.success("Business settings saved");
    } catch (err) {
      setError(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || loading) {
    return (
      <AppShell title="Settings" businessName={businessName || name}>
        <Spin />
      </AppShell>
    );
  }

  return (
    <AppShell title="Settings" businessName={businessName || name}>
      {(authError || error) && (
        <Alert
          type="error"
          message={authError || error}
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Card title="Business profile">
          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            style={{ maxWidth: 560 }}
          >
            <Form.Item
              label="Business name"
              name="name"
              rules={[{ required: true }]}
            >
              <Input />
            </Form.Item>
            <Form.Item label="Phone" name="phone">
              <Input />
            </Form.Item>
            <Form.Item label="Address" name="address">
              <Input.TextArea rows={3} />
            </Form.Item>
            <Form.Item
              label="Timezone"
              name="timezone"
              rules={[{ required: true }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              label="Currency"
              name="currency"
              rules={[{ required: true, len: 3 }]}
            >
              <Input maxLength={3} />
            </Form.Item>
            <Form.Item
              label="Cash on delivery"
              name="codEnabled"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={saving}>
              Save changes
            </Button>
          </Form>
        </Card>

        <Card title="Working hours">
          <Typography.Paragraph type="secondary">
            Outside these hours, WhatsApp ordering replies with a closed
            message.
          </Typography.Paragraph>
          <Space direction="vertical" style={{ width: "100%" }} size={12}>
            {DAYS.map((day) => {
              const hours = workingHours?.[day];
              if (!hours) return null;
              return (
                <div
                  key={day}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "120px 90px 1fr 1fr",
                    gap: 12,
                    alignItems: "center",
                  }}
                >
                  <Typography.Text style={{ textTransform: "capitalize" }}>
                    {day}
                  </Typography.Text>
                  <Switch
                    checked={!hours.closed}
                    checkedChildren="Open"
                    unCheckedChildren="Closed"
                    onChange={(open) => updateDay(day, { closed: !open })}
                  />
                  <TimePicker
                    format="HH:mm"
                    value={dayjs(hours.open, "HH:mm")}
                    disabled={hours.closed}
                    onChange={(v) =>
                      updateDay(day, { open: v?.format("HH:mm") || "09:00" })
                    }
                  />
                  <TimePicker
                    format="HH:mm"
                    value={dayjs(hours.close, "HH:mm")}
                    disabled={hours.closed}
                    onChange={(v) =>
                      updateDay(day, { close: v?.format("HH:mm") || "21:00" })
                    }
                  />
                </div>
              );
            })}
          </Space>
          <Button
            type="primary"
            style={{ marginTop: 16 }}
            loading={saving}
            onClick={() => form.submit()}
          >
            Save hours
          </Button>
        </Card>
      </Space>
    </AppShell>
  );
}
