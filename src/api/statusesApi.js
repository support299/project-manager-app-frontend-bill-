import { baseApi, unwrap } from "./baseApi.js";

export const statusesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getStatuses: builder.query({
      query: (params) => ({ url: "/statuses/", params }),
      transformResponse: unwrap,
      providesTags: [{ type: "Status", id: "LIST" }],
    }),
    createStatus: builder.mutation({
      query: (body) => ({ url: "/statuses/", method: "POST", body }),
      transformResponse: unwrap,
      invalidatesTags: [{ type: "Status", id: "LIST" }],
    }),
    updateStatus: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/statuses/${id}/`, method: "PATCH", body }),
      transformResponse: unwrap,
      invalidatesTags: [{ type: "Status", id: "LIST" }],
    }),
    deleteStatus: builder.mutation({
      query: (id) => ({ url: `/statuses/${id}/`, method: "DELETE" }),
      invalidatesTags: [{ type: "Status", id: "LIST" }],
    }),
  }),
});

export const {
  useGetStatusesQuery,
  useCreateStatusMutation,
  useUpdateStatusMutation,
  useDeleteStatusMutation,
} = statusesApi;
