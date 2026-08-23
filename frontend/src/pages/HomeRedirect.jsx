import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getAccessToken } from "../lib/auth-storage";

export default function HomeRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate(getAccessToken() ? "/dashboard" : "/login", { replace: true });
  }, [navigate]);

  return null;
}
