"use client";

import {
  AppstoreOutlined,
  BarChartOutlined,
  DashboardOutlined,
  InboxOutlined,
  LogoutOutlined,
  SettingOutlined,
  ShoppingOutlined,
  TeamOutlined,
  UnorderedListOutlined,
  UserOutlined,
  WhatsAppOutlined,
} from "@ant-design/icons";
import { Layout, Menu, Typography, Button, Space, theme } from "antd";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { clearAccessToken, getAccessToken } from "@/lib/auth-storage";

const { Header, Sider, Content } = Layout;

const NAV_ITEMS = [
  { key: "/dashboard", icon: <DashboardOutlined />, label: "Dashboard" },
  { key: "/orders", icon: <UnorderedListOutlined />, label: "Orders" },
  { key: "/products", icon: <ShoppingOutlined />, label: "Products" },
  { key: "/categories", icon: <AppstoreOutlined />, label: "Categories" },
  { key: "/customers", icon: <TeamOutlined />, label: "Customers" },
  { key: "/inventory", icon: <InboxOutlined />, label: "Inventory" },
  { key: "/reports", icon: <BarChartOutlined />, label: "Reports" },
  { key: "/whatsapp", icon: <WhatsAppOutlined />, label: "WhatsApp" },
  { key: "/users", icon: <UserOutlined />, label: "Users" },
  { key: "/settings", icon: <SettingOutlined />, label: "Settings" },
];

type AppShellProps = {
  title: string;
  children: React.ReactNode;
  businessName?: string;
};

export function AppShell({ title, children, businessName }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const {
    token: { colorBgContainer },
  } = theme.useToken();

  const selectedKey = useMemo(() => {
    const match = NAV_ITEMS.find(
      (item) => pathname === item.key || pathname.startsWith(`${item.key}/`),
    );
    return match?.key ?? "/dashboard";
  }, [pathname]);

  async function handleLogout() {
    try {
      await api("/auth/logout", {
        method: "POST",
        token: getAccessToken() || undefined,
      });
    } catch {
      // ignore network errors on logout
    } finally {
      clearAccessToken();
      router.replace("/login");
    }
  }

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        breakpoint="lg"
      >
        <div
          style={{
            height: 56,
            margin: 12,
            display: "flex",
            alignItems: "center",
            color: "#fff",
            fontWeight: 700,
            fontSize: collapsed ? 16 : 20,
            letterSpacing: "-0.02em",
            paddingInline: 8,
          }}
        >
          {collapsed ? "M" : "Mashrum"}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={NAV_ITEMS.map((item) => ({
            key: item.key,
            icon: item.icon,
            label: <Link href={item.key}>{item.label}</Link>,
          }))}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: colorBgContainer,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingInline: 24,
            borderBottom: "1px solid #e5ebe7",
          }}
        >
          <div>
            <Typography.Title level={4} style={{ margin: 0 }}>
              {title}
            </Typography.Title>
            {businessName ? (
              <Typography.Text type="secondary">{businessName}</Typography.Text>
            ) : null}
          </div>
          <Space>
            <Button icon={<LogoutOutlined />} onClick={handleLogout}>
              Logout
            </Button>
          </Space>
        </Header>
        <Content style={{ margin: 24 }}>{children}</Content>
      </Layout>
    </Layout>
  );
}
