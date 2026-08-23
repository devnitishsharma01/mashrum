import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Row,
  Space,
  Statistic,
  Table,
  Typography,
} from "antd";
import dayjs from "dayjs";
import { useCallback, useEffect, useState } from "react";
import AppShell from "../components/AppShell";
import { useAuthSession } from "../hooks/useAuthSession";
import client from "../api/client";
import { formatMoney } from "../lib/format";

export default function Reports() {
  const { loading: authLoading, error: authError, businessName, token } =
    useAuthSession();
  const [range, setRange] = useState([
    dayjs().startOf("day"),
    dayjs().endOf("day"),
  ]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        from: range[0].format("YYYY-MM-DD"),
        to: range[1].format("YYYY-MM-DD"),
      });
      const data = await client.get(`/reports/sales?${params}`);
      setReport(data);
    } catch (err) {
      setError(err.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  }, [token, range]);

  useEffect(() => {
    if (!authLoading && token) void load();
  }, [authLoading, token, load]);

  const currency = report?.currency || "INR";

  return (
    <AppShell title="Reports" businessName={businessName}>
      {(authError || error) && (
        <Alert
          type="error"
          message={authError || error}
          style={{ marginBottom: 16 }}
        />
      )}

      <Space wrap style={{ marginBottom: 16 }}>
        <DatePicker.RangePicker
          value={range}
          onChange={(v) => {
            if (v?.[0] && v?.[1]) setRange([v[0], v[1]]);
          }}
        />
        <Button type="primary" onClick={() => void load()} loading={loading}>
          Refresh
        </Button>
      </Space>

      <Typography.Paragraph type="secondary">
        Range {report?.range.from} → {report?.range.to} (
        {report?.range.timezone})
      </Typography.Paragraph>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic title="Orders" value={report?.summary.orders || 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="Gross sales"
              value={report?.summary.grossSales || 0}
              formatter={(v) => formatMoney(Number(v), currency)}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="COD collected"
              value={report?.summary.collectedSales || 0}
              formatter={(v) => formatMoney(Number(v), currency)}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="Avg order value"
              value={report?.summary.averageOrderValue || 0}
              formatter={(v) => formatMoney(Number(v), currency)}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="By status" loading={loading}>
            <Table
              rowKey="status"
              pagination={false}
              size="small"
              dataSource={report?.byStatus || []}
              columns={[
                {
                  title: "Status",
                  dataIndex: "status",
                  render: (v) => v.replaceAll("_", " "),
                },
                { title: "Orders", dataIndex: "count", width: 90 },
                {
                  title: "Total",
                  dataIndex: "total",
                  render: (v) => formatMoney(v, currency),
                },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Top products" loading={loading}>
            <Table
              rowKey="name"
              pagination={false}
              size="small"
              dataSource={report?.topProducts || []}
              locale={{ emptyText: "No product sales in range" }}
              columns={[
                { title: "Product", dataIndex: "name" },
                { title: "Qty", dataIndex: "qty", width: 70 },
                {
                  title: "Revenue",
                  dataIndex: "revenue",
                  render: (v) => formatMoney(v, currency),
                },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </AppShell>
  );
}
