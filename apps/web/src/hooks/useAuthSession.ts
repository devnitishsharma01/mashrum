"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, type ApiError } from "@/lib/api";
import { clearAccessToken, getAccessToken } from "@/lib/auth-storage";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  business: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
    currency: string;
    codEnabled: boolean;
  };
};

export function useAuthSession() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    api<SessionUser>("/auth/me", { token })
      .then(setUser)
      .catch((err: ApiError) => {
        if (err.code === "UNAUTHORIZED") {
          clearAccessToken();
          router.replace("/login");
          return;
        }
        setError(err.message || "Failed to load session");
      })
      .finally(() => setLoading(false));
  }, [router]);

  return {
    user,
    loading,
    error,
    token: getAccessToken(),
    businessName: user?.business.name,
    currency: user?.business.currency ?? "INR",
  };
}
