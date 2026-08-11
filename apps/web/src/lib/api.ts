const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export type ApiError = {
  code: string;
  message: string;
  details?: unknown;
};

async function parseResponse<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = (body?.error ?? {
      code: "REQUEST_FAILED",
      message: res.statusText || "Request failed",
    }) as ApiError;
    throw error;
  }
  return body.data as T;
}

export async function api<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  return parseResponse<T>(res);
}

export async function uploadImage(
  file: File,
  token: string,
): Promise<{ url: string; path: string }> {
  const body = new FormData();
  body.append("file", file);
  return api<{ url: string; path: string }>("/uploads/images", {
    method: "POST",
    token,
    body,
  });
}
