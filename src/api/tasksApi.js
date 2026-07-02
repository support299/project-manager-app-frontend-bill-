import { baseApi, unwrap } from "./baseApi.js";

export const tasksApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getTasks: builder.query({
      query: (params = {}) => ({
        url: "/tasks/",
        params: { parent_only: "true", ...params },
      }),
      transformResponse: unwrap,
      providesTags: (result) =>
        result
          ? [
              ...result.map((t) => ({ type: "Task", id: t.id })),
              { type: "Task", id: "LIST" },
            ]
          : [{ type: "Task", id: "LIST" }],
    }),
    getSubtasksSummary: builder.query({
      query: (params) => ({
        url: "/tasks/subtasks-summary/",
        params,
      }),
      transformResponse: unwrap,
      providesTags: [{ type: "Task", id: "SUBTASKS" }],
    }),
    getTask: builder.query({
      query: (id) => `/tasks/${id}/`,
      transformResponse: unwrap,
      providesTags: (_r, _e, id) => [{ type: "Task", id }],
    }),
    createTask: builder.mutation({
      query: (body) => ({ url: "/tasks/", method: "POST", body }),
      transformResponse: unwrap,
      invalidatesTags: (result, error, body) => {
        const tags = [
          { type: "Task", id: "LIST" },
          { type: "Dashboard" },
        ];
        if (body?.parent_task_id) {
          tags.push({ type: "Task", id: `${body.parent_task_id}-subtasks` });
        }
        return tags;
      },
    }),
    updateTask: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/tasks/${id}/`, method: "PATCH", body }),
      transformResponse: unwrap,
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Task", id },
        { type: "Task", id: "LIST" },
        { type: "Dashboard" },
      ],
    }),
    deleteTask: builder.mutation({
      query: (id) => ({ url: `/tasks/${id}/`, method: "DELETE" }),
      invalidatesTags: [
        { type: "Task", id: "LIST" },
        { type: "Dashboard" },
      ],
    }),
    getSubtasks: builder.query({
      query: (taskId) => `/tasks/${taskId}/subtasks/`,
      transformResponse: unwrap,
      providesTags: (_r, _e, taskId) => [{ type: "Task", id: `${taskId}-subtasks` }],
    }),
    getComments: builder.query({
      query: (taskId) => `/tasks/${taskId}/comments/`,
      transformResponse: unwrap,
      providesTags: (_r, _e, taskId) => [{ type: "Comment", id: taskId }],
    }),
    addComment: builder.mutation({
      query: ({ taskId, ...body }) => ({
        url: `/tasks/${taskId}/comments/`,
        method: "POST",
        body,
      }),
      transformResponse: unwrap,
      invalidatesTags: (_r, _e, { taskId }) => [{ type: "Comment", id: taskId }],
    }),
    getStatusChanges: builder.query({
      query: (taskId) => `/tasks/${taskId}/status-changes/`,
      transformResponse: unwrap,
    }),
    getTimeEntries: builder.query({
      query: (taskId) => `/tasks/${taskId}/time-entries/`,
      transformResponse: unwrap,
      providesTags: (_r, _e, taskId) => [{ type: "TimeEntry", id: taskId }],
    }),
    createTimeEntry: builder.mutation({
      query: ({ taskId, ...body }) => ({
        url: `/tasks/${taskId}/time-entries/`,
        method: "POST",
        body,
      }),
      transformResponse: unwrap,
      invalidatesTags: (_r, _e, { taskId }) => [{ type: "TimeEntry", id: taskId }],
    }),
    updateTimeEntry: builder.mutation({
      query: ({ taskId, entryId, ...body }) => ({
        url: `/tasks/${taskId}/time-entries/${entryId}/`,
        method: "PATCH",
        body,
      }),
      transformResponse: unwrap,
      invalidatesTags: (_r, _e, { taskId }) => [{ type: "TimeEntry", id: taskId }],
    }),
    deleteTimeEntry: builder.mutation({
      query: ({ taskId, entryId }) => ({
        url: `/tasks/${taskId}/time-entries/${entryId}/`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { taskId }) => [{ type: "TimeEntry", id: taskId }],
    }),
    getTaskFiles: builder.query({
      query: (taskId) => `/tasks/${taskId}/files/`,
      transformResponse: unwrap,
      providesTags: (_r, _e, taskId) => [{ type: "File", id: taskId }],
    }),
    uploadTaskFile: builder.mutation({
      query: ({ taskId, file, uploaded_by }) => {
        const formData = new FormData();
        formData.append("file", file);
        if (uploaded_by) formData.append("uploaded_by", uploaded_by);
        return {
          url: `/tasks/${taskId}/files/`,
          method: "POST",
          body: formData,
        };
      },
      transformResponse: unwrap,
      invalidatesTags: (_r, _e, { taskId }) => [{ type: "File", id: taskId }],
    }),
    deleteTaskFile: builder.mutation({
      query: ({ taskId, fileId }) => ({
        url: `/tasks/${taskId}/files/${fileId}/`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { taskId }) => [{ type: "File", id: taskId }],
    }),
  }),
});

export const {
  useGetTasksQuery,
  useGetSubtasksSummaryQuery,
  useGetTaskQuery,
  useCreateTaskMutation,
  useUpdateTaskMutation,
  useDeleteTaskMutation,
  useGetSubtasksQuery,
  useGetCommentsQuery,
  useAddCommentMutation,
  useGetStatusChangesQuery,
  useGetTimeEntriesQuery,
  useCreateTimeEntryMutation,
  useUpdateTimeEntryMutation,
  useDeleteTimeEntryMutation,
  useGetTaskFilesQuery,
  useUploadTaskFileMutation,
  useDeleteTaskFileMutation,
} = tasksApi;
