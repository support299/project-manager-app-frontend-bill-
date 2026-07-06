import { baseApi, unwrap } from "./baseApi.js";

function parseTaskQueryArg(arg) {
  if (arg == null) return { taskId: null, meeting_todos: false };
  if (typeof arg === "string") return { taskId: arg, meeting_todos: false };
  return { taskId: arg.id ?? arg.taskId, meeting_todos: !!arg.meeting_todos };
}

function taskRequest(taskId, suffix = "", meeting_todos = false) {
  return meeting_todos
    ? { url: `/tasks/${taskId}${suffix}`, params: { meeting_todos: "true" } }
    : `/tasks/${taskId}${suffix}`;
}

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
    getSubtasksList: builder.query({
      query: (params = {}) => ({
        url: "/tasks/",
        params: { subtasks_only: "true", ...params },
      }),
      transformResponse: unwrap,
      providesTags: [{ type: "Task", id: "SUBTASKS" }],
    }),
    getTask: builder.query({
      query: (arg) => {
        const { taskId, meeting_todos } = parseTaskQueryArg(arg);
        return taskRequest(taskId, "/", meeting_todos);
      },
      transformResponse: unwrap,
      providesTags: (_r, _e, arg) => [{ type: "Task", id: parseTaskQueryArg(arg).taskId }],
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
          tags.push({ type: "Task", id: "SUBTASKS" });
        }
        return tags;
      },
    }),
    updateTask: builder.mutation({
      query: ({ id, taskId, meeting_todos, ...body }) => {
        const tid = id ?? taskId;
        return meeting_todos
          ? { url: `/tasks/${tid}/`, method: "PATCH", body, params: { meeting_todos: "true" } }
          : { url: `/tasks/${tid}/`, method: "PATCH", body };
      },
      transformResponse: unwrap,
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Task", id },
        { type: "Task", id: "LIST" },
        { type: "Task", id: "SUBTASKS" },
        { type: "TaskHistory", id },
        { type: "Dashboard" },
      ],
    }),
    deleteTask: builder.mutation({
      query: (arg) => {
        const { taskId, meeting_todos } = parseTaskQueryArg(arg);
        return {
          url: `/tasks/${taskId}/`,
          method: "DELETE",
          params: meeting_todos ? { meeting_todos: "true" } : undefined,
        };
      },
      invalidatesTags: [
        { type: "Task", id: "LIST" },
        { type: "Task", id: "SUBTASKS" },
        { type: "Dashboard" },
      ],
    }),
    getSubtasks: builder.query({
      query: (arg) => {
        const { taskId, meeting_todos } = parseTaskQueryArg(arg);
        return taskRequest(taskId, "/subtasks/", meeting_todos);
      },
      transformResponse: unwrap,
      providesTags: (_r, _e, arg) => [{ type: "Task", id: `${parseTaskQueryArg(arg).taskId}-subtasks` }],
    }),
    getComments: builder.query({
      query: (arg) => {
        const { taskId, meeting_todos } = parseTaskQueryArg(arg);
        return taskRequest(taskId, "/comments/", meeting_todos);
      },
      transformResponse: unwrap,
      providesTags: (_r, _e, arg) => [{ type: "Comment", id: parseTaskQueryArg(arg).taskId }],
    }),
    addComment: builder.mutation({
      query: ({ taskId, meeting_todos, ...body }) => ({
        url: `/tasks/${taskId}/comments/`,
        method: "POST",
        body,
        params: meeting_todos ? { meeting_todos: "true" } : undefined,
      }),
      transformResponse: unwrap,
      invalidatesTags: (_r, _e, { taskId }) => [
        { type: "Comment", id: taskId },
        { type: "TaskHistory", id: taskId },
      ],
    }),
    getStatusChanges: builder.query({
      query: (arg) => {
        const { taskId, meeting_todos } = parseTaskQueryArg(arg);
        return taskRequest(taskId, "/status-changes/", meeting_todos);
      },
      transformResponse: unwrap,
    }),
    getTaskHistory: builder.query({
      query: (arg) => {
        const { taskId, meeting_todos } = parseTaskQueryArg(arg);
        return taskRequest(taskId, "/history/", meeting_todos);
      },
      transformResponse: unwrap,
      providesTags: (_r, _e, arg) => [{ type: "TaskHistory", id: parseTaskQueryArg(arg).taskId }],
    }),
    getTimeEntries: builder.query({
      query: (arg) => {
        const { taskId, meeting_todos } = parseTaskQueryArg(arg);
        return taskRequest(taskId, "/time-entries/", meeting_todos);
      },
      transformResponse: unwrap,
      providesTags: (_r, _e, arg) => [{ type: "TimeEntry", id: parseTaskQueryArg(arg).taskId }],
    }),
    createTimeEntry: builder.mutation({
      query: ({ taskId, meeting_todos, ...body }) => ({
        url: `/tasks/${taskId}/time-entries/`,
        method: "POST",
        body,
        params: meeting_todos ? { meeting_todos: "true" } : undefined,
      }),
      transformResponse: unwrap,
      invalidatesTags: (_r, _e, { taskId }) => [
        { type: "TimeEntry", id: taskId },
        { type: "TaskHistory", id: taskId },
      ],
    }),
    updateTimeEntry: builder.mutation({
      query: ({ taskId, entryId, meeting_todos, ...body }) => ({
        url: `/tasks/${taskId}/time-entries/${entryId}/`,
        method: "PATCH",
        body,
        params: meeting_todos ? { meeting_todos: "true" } : undefined,
      }),
      transformResponse: unwrap,
      invalidatesTags: (_r, _e, { taskId }) => [{ type: "TimeEntry", id: taskId }],
    }),
    deleteTimeEntry: builder.mutation({
      query: ({ taskId, entryId, meeting_todos }) => ({
        url: `/tasks/${taskId}/time-entries/${entryId}/`,
        method: "DELETE",
        params: meeting_todos ? { meeting_todos: "true" } : undefined,
      }),
      invalidatesTags: (_r, _e, { taskId }) => [{ type: "TimeEntry", id: taskId }],
    }),
    getTaskFiles: builder.query({
      query: (arg) => {
        const { taskId, meeting_todos } = parseTaskQueryArg(arg);
        return taskRequest(taskId, "/files/", meeting_todos);
      },
      transformResponse: unwrap,
      providesTags: (_r, _e, arg) => [{ type: "File", id: parseTaskQueryArg(arg).taskId }],
    }),
    uploadTaskFile: builder.mutation({
      query: ({ taskId, file, uploaded_by, meeting_todos }) => {
        const formData = new FormData();
        formData.append("file", file);
        if (uploaded_by) formData.append("uploaded_by", uploaded_by);
        return {
          url: `/tasks/${taskId}/files/`,
          method: "POST",
          body: formData,
          params: meeting_todos ? { meeting_todos: "true" } : undefined,
        };
      },
      transformResponse: unwrap,
      invalidatesTags: (_r, _e, { taskId }) => [
        { type: "File", id: taskId },
        { type: "TaskHistory", id: taskId },
      ],
    }),
    deleteTaskFile: builder.mutation({
      query: ({ taskId, fileId, meeting_todos }) => ({
        url: `/tasks/${taskId}/files/${fileId}/`,
        method: "DELETE",
        params: meeting_todos ? { meeting_todos: "true" } : undefined,
      }),
      invalidatesTags: (_r, _e, { taskId }) => [
        { type: "File", id: taskId },
        { type: "TaskHistory", id: taskId },
      ],
    }),
  }),
});

export const {
  useGetTasksQuery,
  useGetSubtasksSummaryQuery,
  useGetSubtasksListQuery,
  useGetTaskQuery,
  useCreateTaskMutation,
  useUpdateTaskMutation,
  useDeleteTaskMutation,
  useGetSubtasksQuery,
  useGetCommentsQuery,
  useAddCommentMutation,
  useGetStatusChangesQuery,
  useGetTaskHistoryQuery,
  useGetTimeEntriesQuery,
  useCreateTimeEntryMutation,
  useUpdateTimeEntryMutation,
  useDeleteTimeEntryMutation,
  useGetTaskFilesQuery,
  useUploadTaskFileMutation,
  useDeleteTaskFileMutation,
} = tasksApi;
