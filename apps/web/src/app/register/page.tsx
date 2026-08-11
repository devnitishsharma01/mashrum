"use client";

import { Alert, Button, Form, Input, Typography } from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, type ApiError } from "@/lib/api";
import { setAccessToken } from "@/lib/auth-storage";

type RegisterForm = {
  businessName: string;
  name: string;
  email: string;
  password: string;
};

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFinish(values: RegisterForm) {
    setLoading(true);
    setError(null);
    try {
      const data = await api<{ accessToken: string }>("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          ...values,
          timezone: "Asia/Kolkata",
          currency: "INR",
        }),
      });
      setAccessToken(data.accessToken);
      router.replace("/dashboard");
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1 className="auth-brand">Mashrum</h1>
        <p className="auth-subtitle">Create your business workspace</p>
        {error ? (
          <Alert
            type="error"
            message={error}
            showIcon
            style={{ marginBottom: 16 }}
          />
        ) : null}
        <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
          <Form.Item
            label="Business name"
            name="businessName"
            rules={[
              { required: true, message: "Business name is required" },
              { min: 2, message: "At least 2 characters" },
            ]}
          >
            <Input size="large" />
          </Form.Item>
          <Form.Item
            label="Your name"
            name="name"
            rules={[{ required: true, message: "Name is required" }]}
          >
            <Input size="large" />
          </Form.Item>
          <Form.Item
            label="Email"
            name="email"
            rules={[
              { required: true, message: "Email is required" },
              { type: "email", message: "Enter a valid email" },
            ]}
          >
            <Input size="large" autoComplete="email" />
          </Form.Item>
          <Form.Item
            label="Password"
            name="password"
            rules={[
              { required: true, message: "Password is required" },
              { min: 8, message: "At least 8 characters" },
            ]}
          >
            <Input.Password size="large" autoComplete="new-password" />
          </Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            size="large"
            block
            loading={loading}
          >
            Create account
          </Button>
        </Form>
        <Typography.Paragraph style={{ marginTop: 16, marginBottom: 0 }}>
          Already have an account? <Link href="/login">Sign in</Link>
        </Typography.Paragraph>
      </div>
    </div>
  );
}
