import { Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Spin } from "antd";
import { fetchMe, clearAuth } from "../store/authSlice";
import { getAccessToken } from "../lib/auth-storage";

export default function ProtectedRoute({ children }) {
  const location = useLocation();
  const dispatch = useDispatch();
  const { user, loading, initialized } = useSelector((state) => state.auth);
  const token = getAccessToken();

  useEffect(() => {
    if (token && !initialized && !loading) {
      dispatch(fetchMe())
        .unwrap()
        .catch((err) => {
          if (err?.code === "UNAUTHORIZED" || err?.code === "NO_TOKEN") {
            dispatch(clearAuth());
          }
        });
    }
  }, [dispatch, token, initialized, loading]);

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!initialized || loading) {
    return (
      <div className="page-empty">
        <Spin size="large" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}
