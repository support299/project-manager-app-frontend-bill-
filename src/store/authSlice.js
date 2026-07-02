import { createSlice } from "@reduxjs/toolkit";
import { clearTokens, loadTokens, saveTokens } from "@/utils/session.js";

const tokens = loadTokens();

const initialState = {
  accessToken: tokens.access,
  refreshToken: tokens.refresh,
  session: null,
  loaded: false,
  authError: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setTokens(state, action) {
      const { access, refresh } = action.payload;
      if (access !== undefined) state.accessToken = access;
      if (refresh !== undefined) state.refreshToken = refresh;
      saveTokens(state.accessToken, state.refreshToken);
    },
    setSession(state, action) {
      state.session = action.payload;
      state.loaded = true;
      state.authError = null;
    },
    setSessionLoaded(state, action) {
      state.loaded = action.payload;
    },
    setAuthError(state, action) {
      state.authError = action.payload;
      state.accessToken = null;
      state.refreshToken = null;
      state.session = null;
      state.loaded = true;
      clearTokens();
    },
    logout(state) {
      state.accessToken = null;
      state.refreshToken = null;
      state.session = null;
      state.loaded = true;
      state.authError = null;
      clearTokens();
    },
  },
});

export const { setTokens, setSession, setSessionLoaded, setAuthError, logout } = authSlice.actions;
export default authSlice.reducer;

export const selectAuth = (state) => state.auth;
export const selectSession = (state) => state.auth.session;
export const selectIsAdmin = (state) => state.auth.session?.is_admin ?? false;
export const selectLocationId = (state) => state.auth.session?.ghl_location_id ?? null;
