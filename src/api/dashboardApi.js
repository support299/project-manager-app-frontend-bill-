import { baseApi, unwrap } from "./baseApi.js";

export const dashboardApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getDashboardStats: builder.query({
      query: (params) => ({ url: "/dashboard/stats/", params }),
      transformResponse: unwrap,
      providesTags: [{ type: "Dashboard" }],
    }),
  }),
});

export const { useGetDashboardStatsQuery } = dashboardApi;
