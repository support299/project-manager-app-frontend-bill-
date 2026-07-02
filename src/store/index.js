import { configureStore } from "@reduxjs/toolkit";
import { baseApi } from "@/api/index.js";
import { ghlApi } from "@/api/ghlApi.js";
import authReducer from "@/store/authSlice.js";
import uiReducer from "@/store/uiSlice.js";

export function createAppStore() {
  return configureStore({
    reducer: {
      auth: authReducer,
      ui: uiReducer,
      [baseApi.reducerPath]: baseApi.reducer,
      [ghlApi.reducerPath]: ghlApi.reducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(baseApi.middleware, ghlApi.middleware),
  });
}

export const store = createAppStore();
