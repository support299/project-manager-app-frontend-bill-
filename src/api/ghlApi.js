import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

const ghlBaseUrl = import.meta.env.VITE_GHL_API_URL || "/api/ghl";

function unwrap(response) {
  if (response && typeof response === "object" && "data" in response) {
    return response.data;
  }
  return response;
}

export const ghlApi = createApi({
  reducerPath: "ghlApi",
  baseQuery: fetchBaseQuery({ baseUrl: ghlBaseUrl }),
  endpoints: (builder) => ({
    getOAuthConfig: builder.mutation({
      query: (body = {}) => ({
        url: "/oauth-config/",
        method: "POST",
        body,
      }),
      transformResponse: unwrap,
    }),
    exchangeCode: builder.mutation({
      query: (body) => ({
        url: "/exchange-code/",
        method: "POST",
        body,
      }),
      transformResponse: unwrap,
    }),
  }),
});

export const { useGetOAuthConfigMutation, useExchangeCodeMutation } = ghlApi;
