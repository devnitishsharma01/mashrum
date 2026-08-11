import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ConfigProvider, App as AntApp } from "antd";
import type { Metadata } from "next";
import { appTheme } from "@/theme/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mashrum",
  description: "WhatsApp ordering & business management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AntdRegistry>
          <ConfigProvider theme={appTheme}>
            <AntApp>{children}</AntApp>
          </ConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
