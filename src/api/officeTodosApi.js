import { baseApi, unwrap } from "./baseApi.js";

export const officeTodosApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getOfficeTodos: builder.query({
      query: (params) => ({ url: "/office-todos/", params }),
      transformResponse: unwrap,
      providesTags: (result) =>
        result
          ? [
              ...result.map((t) => ({ type: "OfficeTodo", id: t.id })),
              { type: "OfficeTodo", id: "LIST" },
            ]
          : [{ type: "OfficeTodo", id: "LIST" }],
    }),
    createOfficeTodo: builder.mutation({
      query: (body) => ({ url: "/office-todos/", method: "POST", body }),
      transformResponse: unwrap,
      invalidatesTags: [{ type: "OfficeTodo", id: "LIST" }],
    }),
    updateOfficeTodo: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/office-todos/${id}/`, method: "PATCH", body }),
      transformResponse: unwrap,
      invalidatesTags: (_r, _e, { id }) => [
        { type: "OfficeTodo", id },
        { type: "OfficeTodo", id: "LIST" },
      ],
    }),
    deleteOfficeTodo: builder.mutation({
      query: (id) => ({ url: `/office-todos/${id}/`, method: "DELETE" }),
      invalidatesTags: [{ type: "OfficeTodo", id: "LIST" }],
    }),
  }),
});

export const {
  useGetOfficeTodosQuery,
  useCreateOfficeTodoMutation,
  useUpdateOfficeTodoMutation,
  useDeleteOfficeTodoMutation,
} = officeTodosApi;
