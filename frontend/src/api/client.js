import axios from "axios";
import { getAccessToken, clearAccessToken } from "../lib/auth-storage";

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:4000",
  withCredentials: true,
});

client.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (
    !config.headers["Content-Type"] &&
    !(config.data instanceof FormData)
  ) {
    config.headers["Content-Type"] = "application/json";
  }
  return config;
});

client.interceptors.response.use(
  (response) => response.data.data,
  (error) => {
    const errBody = error.response?.data?.error;
    const apiError = errBody || {
      code: "REQUEST_FAILED",
      message: error.response?.statusText || error.message || "Request failed",
    };

    if (error.response?.status === 401) {
      clearAccessToken();
      const path = window.location.pathname;
      if (path !== "/login" && path !== "/register") {
        window.location.href = "/login";
      }
    }

    return Promise.reject(apiError);
  },
);

export default client;

export async function uploadImage(file) {
  const body = new FormData();
  body.append("file", file);
  return client.post("/uploads/images", body);
}
