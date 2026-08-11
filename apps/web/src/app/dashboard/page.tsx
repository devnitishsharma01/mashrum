"use client";

import {
  Alert,
  Card,
  Col,
  Row,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuthSession } from "@/hooks/useAuthSession";
import { api, type ApiError } from "@/lib/api";
import { formatMoney } from "@/lib/format";

type DashboardSummary = {
  date: string;
  timezone: string;
  currency: string;
  codEnabled: boolean;
  whatsappStatus: string;
  metrics: {
    ordersToday: number;
    openOrders: number;
    pendingPayments: number;
    todaySales: number;
    todayCollected: number;
    confirmedToday: number;
    deliveredToday: number;
    completedToday: number;
    lowStockItems: number;
  };
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    paymentStatus: string;
    total: number;
    createdAt: string;
    customer: { name: string | null; waId: string };
  }>;
};

export default function DashboardPage() {
  const { loading: authLoading, error: authError, businessName, token, user } =
    useAuthSession();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !token) return;
    api<DashboardSummary>("/dashboard/summary", { token })
      .then(setSummary)
      .catch((err: ApiError) => {
        setError(err.message || "Failed to load dashboard");
      })
      .finally(() => setLoading(false));
  }, [authLoading, token]);

  if (authLoading || loading) {
    return (
      <div className="page-empty">
        <Spin size="large" />
      </div>
    );
  }

  if (authError || error) {
    return (
      <div className="page-empty">
        <Alert type="error" message={authError || error} />
      </div>
    );
  }

  const m = summary?.metrics;
  const currency = summary?.currency || "INR";

  return (
    <AppShell title="Dashboard" businessName={businessName}>
      <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
        Welcome back, {user?.name}. Snapshot for {summary?.date} (
        {summary?.timezone}).
      </Typography.Paragraph>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="Orders today" value={m?.ordersToday || 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Today's sales"
              value={m?.todaySales || 0}
              formatter={(v) => formatMoney(Number(v), currency)}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="Open orders" value={m?.openOrders || 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Pending payments"
              value={m?.pendingPayments || 0}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="COD collected today"
              value={m?.todayCollected || 0}
              formatter={(v) => formatMoney(Number(v), currency)}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="Delivered today" value={m?.deliveredToday || 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="Low stock items" value={m?.lowStockItems || 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="WhatsApp"
              value={summary?.whatsappStatus || "DISCONNECTED"}
            />
          </Card>
        </Col>
      </Row>

      <Card title="Recent orders" style={{ marginTop: 16 }}>
        <Table
          rowKey="id"
          pagination={false}
          dataSource={summary?.recentOrders || []}
          locale={{ emptyText: "No orders yet" }}
          columns={[
            { title: "Order", dataIndex: "orderNumber" },
            {
              title: "Customer",
              key: "customer",
              render: (_, row) =>
                `${row.customer.name || "Unnamed"} · ${row.customer.waId}`,
            },
            {
              title: "Total",
              dataIndex: "total",
              render: (v: number) => formatMoney(v, currency),
            },
            {
              title: "Status",
              dataIndex: "status",
              render: (v: string) => <Tag>{v.replaceAll("_", " ")}</Tag>,
            },
            {
              title: "Payment",
              dataIndex: "paymentStatus",
              render: (v: string) => <Tag>{v}</Tag>,
            },
          ]}
        />
      </Card>
    </AppShell>
  );
}
