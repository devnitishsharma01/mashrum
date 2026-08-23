import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import client from "../api/client";
import {
  getAccessToken,
  setAccessToken,
  clearAccessToken,
} from "../lib/auth-storage";

export const fetchMe = createAsyncThunk(
  "auth/fetchMe",
  async (_, { rejectWithValue }) => {
    try {
      const token = getAccessToken();
      if (!token) {
        return rejectWithValue({
          code: "NO_TOKEN",
          message: "Not authenticated",
        });
      }
      const user = await client.get("/auth/me");
      return { user, token };
    } catch (err) {
      return rejectWithValue(err);
    }
  },
);

export const loginUser = createAsyncThunk(
  "auth/login",
  async (credentials, { rejectWithValue }) => {
    try {
      const data = await client.post("/auth/login", credentials);
      setAccessToken(data.accessToken);
      return { accessToken: data.accessToken, user: data.user };
    } catch (err) {
      return rejectWithValue(err);
    }
  },
);

export const registerUser = createAsyncThunk(
  "auth/register",
  async (payload, { rejectWithValue }) => {
    try {
      const data = await client.post("/auth/register", payload);
      setAccessToken(data.accessToken);
      return { accessToken: data.accessToken };
    } catch (err) {
      return rejectWithValue(err);
    }
  },
);

export const logoutUser = createAsyncThunk("auth/logout", async () => {
  try {
    await client.post("/auth/logout");
  } catch {
    // ignore network errors on logout
  } finally {
    clearAccessToken();
  }
});

const initialToken = typeof window !== "undefined" ? getAccessToken() : null;

const authSlice = createSlice({
  name: "auth",
  initialState: {
    user: null,
    business: null,
    token: initialToken,
    loading: false,
    error: null,
    initialized: false,
  },
  reducers: {
    clearAuth(state) {
      state.user = null;
      state.business = null;
      state.token = null;
      state.error = null;
      clearAccessToken();
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMe.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMe.fulfilled, (state, action) => {
        state.loading = false;
        state.initialized = true;
        state.user = action.payload.user;
        state.business = action.payload.user.business;
        state.token = action.payload.token;
      })
      .addCase(fetchMe.rejected, (state, action) => {
        state.loading = false;
        state.initialized = true;
        const err = action.payload;
        state.error = err?.message || "Failed to load session";
        if (err?.code === "UNAUTHORIZED" || err?.code === "NO_TOKEN") {
          state.user = null;
          state.business = null;
          state.token = null;
        }
      })
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload.accessToken;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || "Login failed";
      })
      .addCase(registerUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload.accessToken;
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || "Registration failed";
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.business = null;
        state.token = null;
        state.error = null;
      });
  },
});

export const { clearAuth } = authSlice.actions;
export default authSlice.reducer;
