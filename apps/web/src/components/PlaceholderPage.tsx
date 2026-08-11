"use client";

import { Alert, Empty } from "antd";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { api, type ApiError } from "@/lib/api";
import { clearAccessToken, getAccessToken } from "@/lib/auth-storage";

type Props = {
  title: string;
  description: string;
};

export function PlaceholderPage({ title, description }: Props) {
  const router = useRouter();
  const [businessName, setBusinessName] = useState<string>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    api<{ business: { name: string } }>("/auth/me", { token })
      .then((me) => setBusinessName(me.business.name))
      .catch((err: ApiError) => {
        if (err.code === "UNAUTHORIZED") {
          clearAccessToken();
          router.replace("/login");
          return;
        }
        setError(err.message);
      });
  }, [router]);

  return (
    <AppShell title={title} businessName={businessName}>
      {error ? <Alert type="error" message={error} style={{ marginBottom: 16 }} /> : null}
      <Empty description={description} />
    </AppShell>
  );
}
