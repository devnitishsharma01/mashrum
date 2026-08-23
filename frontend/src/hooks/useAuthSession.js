import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { fetchMe, clearAuth } from "../store/authSlice";
import { getAccessToken } from "../lib/auth-storage";

export function useAuthSession() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, loading, error, token, initialized } = useSelector(
    (state) => state.auth,
  );

  useEffect(() => {
    const storedToken = getAccessToken();
    if (!storedToken) {
      navigate("/login", { replace: true });
      return;
    }
    if (!initialized && !loading) {
      dispatch(fetchMe())
        .unwrap()
        .catch((err) => {
          if (err?.code === "UNAUTHORIZED" || err?.code === "NO_TOKEN") {
            dispatch(clearAuth());
            navigate("/login", { replace: true });
          }
        });
    }
  }, [dispatch, navigate, initialized, loading]);

  return {
    user,
    loading: loading || (!initialized && !!getAccessToken()),
    error,
    token: token || getAccessToken(),
    businessName: user?.business?.name,
    currency: user?.business?.currency ?? "INR",
  };
}
