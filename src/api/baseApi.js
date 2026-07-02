import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { logout, setTokens } from "@/store/authSlice.js";

const baseUrl = import.meta.env.VITE_API_URL || "/api/v1";

const rawBaseQuery = fetchBaseQuery({
  baseUrl,
  prepareHeaders: (headers, { getState }) => {
    const token = getState().auth.accessToken;
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    return headers;
  },
});

async function baseQueryWithReauth(args, api, extraOptions) {
  let result = await rawBaseQuery(args, api, extraOptions);

  if (result.error?.status === 401) {
    const refresh = api.getState().auth.refreshToken;
    if (refresh) {
      const refreshResult = await rawBaseQuery(
        {
          url: "/auth/token/refresh/",
          method: "POST",
          body: { refresh },
        },
        api,
        extraOptions,
      );

      const payload = refreshResult.data?.data ?? refreshResult.data;
      if (payload?.access) {
        api.dispatch(setTokens({ access: payload.access, refresh: payload.refresh ?? refresh }));
        result = await rawBaseQuery(args, api, extraOptions);
      } else {
        api.dispatch(logout());
      }
    }
  }

  return result;
}

export const tagTypes = [
  "Task",
  "Project",
  "Status",
  "Location",
  "User",
  "Dashboard",
  "Comment",
  "TimeEntry",
  "File",
];

export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithReauth,
  tagTypes,
  endpoints: () => ({}),
});

/** Unwrap Django API { data, meta, errors } envelope */
export function unwrap(response) {
  if (response && typeof response === "object" && "data" in response) {
    return response.data;
  }
  return response;
}
