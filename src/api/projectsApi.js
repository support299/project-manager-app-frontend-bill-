import { baseApi, unwrap } from "./baseApi.js";

export const projectsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getProjects: builder.query({
      query: (params) => ({ url: "/projects/", params }),
      transformResponse: unwrap,
      providesTags: (result) =>
        result
          ? [
              ...result.map((p) => ({ type: "Project", id: p.id })),
              { type: "Project", id: "LIST" },
            ]
          : [{ type: "Project", id: "LIST" }],
    }),
    createProject: builder.mutation({
      query: (body) => ({ url: "/projects/", method: "POST", body }),
      transformResponse: unwrap,
      invalidatesTags: [{ type: "Project", id: "LIST" }],
    }),
    updateProject: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/projects/${id}/`, method: "PATCH", body }),
      transformResponse: unwrap,
      invalidatesTags: (_r, _e, { id }) => [{ type: "Project", id }, { type: "Project", id: "LIST" }],
    }),
    deleteProject: builder.mutation({
      query: (id) => ({ url: `/projects/${id}/`, method: "DELETE" }),
      invalidatesTags: [{ type: "Project", id: "LIST" }],
    }),
  }),
});

export const {
  useGetProjectsQuery,
  useCreateProjectMutation,
  useUpdateProjectMutation,
  useDeleteProjectMutation,
} = projectsApi;
