import { Alert, Button, Form, Input, Typography } from "antd";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useDispatch } from "react-redux";
import { loginUser, fetchMe } from "../store/authSlice";

export default function Login() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function onFinish(values) {
    setLoading(true);
    setError(null);
    try {
      await dispatch(loginUser(values)).unwrap();
      await dispatch(fetchMe()).unwrap();
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1 className="auth-brand">Mushroom</h1>
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
          New business? <Link to="/register">Create an account</Link>
        </Typography.Paragraph>
      </div>
    </div>
  );
}
