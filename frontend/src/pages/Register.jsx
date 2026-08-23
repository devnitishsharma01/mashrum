import { Alert, Button, Form, Input, Typography } from "antd";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useDispatch } from "react-redux";
import { registerUser, fetchMe } from "../store/authSlice";

export default function Register() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function onFinish(values) {
    setLoading(true);
    setError(null);
    try {
      await dispatch(
        registerUser({
          ...values,
          timezone: "Asia/Kolkata",
          currency: "INR",
        }),
      ).unwrap();
      await dispatch(fetchMe()).unwrap();
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1 className="auth-brand">Mushroom</h1>
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
          Already have an account? <Link to="/login">Sign in</Link>
        </Typography.Paragraph>
      </div>
    </div>
  );
}
