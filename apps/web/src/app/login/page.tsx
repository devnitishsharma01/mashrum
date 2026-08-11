"use client";

import { Alert, Button, Form, Input, Typography } from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, type ApiError } from "@/lib/api";
import { setAccessToken } from "@/lib/auth-storage";

type LoginForm = {
  email: string;
  password: string;
};

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFinish(values: LoginForm) {
    setLoading(true);
    setError(null);
    try {
      const data = await api<{
        accessToken: string;
        user: { name: string };
      }>("/auth/login", {
        method: "POST",
        body: JSON.stringify(values),
      });
      setAccessToken(data.accessToken);
      router.replace("/dashboard");
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1 className="auth-brand">Mashrum</h1>
        <p className="auth-subtitle">Sign in to manage WhatsApp orders</p>
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
            rules={[{ required: true, message: "Password is required" }]}
          >
            <Input.Password size="large" autoComplete="current-password" />
          </Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            size="large"
            block
            loading={loading}
          >
            Sign in
          </Button>
        </Form>
        <Typography.Paragraph style={{ marginTop: 16, marginBottom: 0 }}>
          New business? <Link href="/register">Create an account</Link>
        </Typography.Paragraph>
      </div>
    </div>
  );
}
