import { baseApi, unwrap } from "./baseApi.js";

export const level10Api = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getLevel10Events: builder.query({
      query: (params = {}) => ({
        url: "/level10/events/",
        params,
      }),
      transformResponse: (response) => unwrap(response),
      providesTags: [{ type: "Level10Event", id: "LIST" }],
    }),
    getLevel10Event: builder.query({
      query: (eventId) => `/level10/events/${eventId}/`,
      transformResponse: (response) => unwrap(response),
      providesTags: (_r, _e, id) => [{ type: "Level10Event", id }],
    }),
    createLevel10Event: builder.mutation({
      query: (body) => ({
        url: "/level10/events/",
        method: "POST",
        body,
      }),
      transformResponse: (response) => unwrap(response),
      invalidatesTags: [{ type: "Level10Event", id: "LIST" }],
    }),
    updateLevel10Event: builder.mutation({
      query: ({ eventId, ...body }) => ({
        url: `/level10/events/${eventId}/`,
        method: "PATCH",
        body,
      }),
      transformResponse: (response) => unwrap(response),
      invalidatesTags: (_r, _e, { eventId }) => [
        { type: "Level10Event", id: "LIST" },
        { type: "Level10Event", id: eventId },
      ],
    }),
    deleteLevel10Event: builder.mutation({
      query: (eventId) => ({
        url: `/level10/events/${eventId}/`,
        method: "DELETE",
      }),
      invalidatesTags: [{ type: "Level10Event", id: "LIST" }],
    }),
    addLevel10Exception: builder.mutation({
      query: ({ eventId, exception_date }) => ({
        url: `/level10/events/${eventId}/exception/`,
        method: "POST",
        body: { exception_date },
      }),
      transformResponse: (response) => unwrap(response),
      invalidatesTags: (_r, _e, { eventId }) => [
        { type: "Level10Event", id: "LIST" },
        { type: "Level10Event", id: eventId },
      ],
    }),
    getLevel10MeetingState: builder.query({
      query: ({ eventId, occurrence_key }) => ({
        url: `/level10/events/${eventId}/meeting/`,
        params: { occurrence_key },
      }),
      transformResponse: (response) => unwrap(response),
      providesTags: (_r, _e, { eventId, occurrence_key }) => [
        { type: "Level10Meeting", id: `${eventId}:${occurrence_key}` },
        { type: "Level10Meeting", id: eventId },
      ],
    }),
    upsertLevel10Timer: builder.mutation({
      query: ({ eventId, ...body }) => ({
        url: `/level10/events/${eventId}/timer/`,
        method: "PUT",
        body,
      }),
      transformResponse: (response) => unwrap(response),
      invalidatesTags: (_r, _e, { eventId, occurrence_key }) => [
        { type: "Level10Meeting", id: `${eventId}:${occurrence_key}` },
      ],
    }),
    createLevel10Segue: builder.mutation({
      query: ({ eventId, ...body }) => ({
        url: `/level10/events/${eventId}/segues/`,
        method: "POST",
        body,
      }),
      transformResponse: (response) => unwrap(response),
      invalidatesTags: (_r, _e, { eventId, occurrence_key }) => [
        { type: "Level10Meeting", id: `${eventId}:${occurrence_key}` },
      ],
    }),
    updateLevel10Segue: builder.mutation({
      query: ({ eventId, segueId, occurrence_key, ...body }) => ({
        url: `/level10/events/${eventId}/segues/${segueId}/`,
        method: "PATCH",
        body,
      }),
      transformResponse: (response) => unwrap(response),
      invalidatesTags: (_r, _e, { eventId, occurrence_key }) => [
        { type: "Level10Meeting", id: `${eventId}:${occurrence_key}` },
      ],
    }),
    deleteLevel10Segue: builder.mutation({
      query: ({ eventId, segueId, occurrence_key }) => ({
        url: `/level10/events/${eventId}/segues/${segueId}/`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { eventId, occurrence_key }) => [
        { type: "Level10Meeting", id: `${eventId}:${occurrence_key}` },
      ],
    }),
    createLevel10Measurable: builder.mutation({
      query: ({ eventId, occurrence_key, ...body }) => ({
        url: `/level10/events/${eventId}/measurables/`,
        method: "POST",
        body,
      }),
      transformResponse: (response) => unwrap(response),
      invalidatesTags: (_r, _e, { eventId }) => [
        { type: "Level10Meeting", id: eventId },
      ],
    }),
    updateLevel10Measurable: builder.mutation({
      query: ({ eventId, measurableId, occurrence_key, ...body }) => ({
        url: `/level10/events/${eventId}/measurables/${measurableId}/`,
        method: "PATCH",
        body,
      }),
      transformResponse: (response) => unwrap(response),
      invalidatesTags: (_r, _e, { eventId }) => [
        { type: "Level10Meeting", id: eventId },
      ],
    }),
    deleteLevel10Measurable: builder.mutation({
      query: ({ eventId, measurableId, occurrence_key }) => ({
        url: `/level10/events/${eventId}/measurables/${measurableId}/`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { eventId }) => [
        { type: "Level10Meeting", id: eventId },
      ],
    }),
    upsertLevel10MeasurableValue: builder.mutation({
      query: ({ eventId, measurableId, ...body }) => ({
        url: `/level10/events/${eventId}/measurables/${measurableId}/value/`,
        method: "PUT",
        body,
      }),
      transformResponse: (response) => unwrap(response),
      // Invalidate all meeting views for this event so week-grid history stays in sync.
      invalidatesTags: (_r, _e, { eventId }) => [
        { type: "Level10Meeting", id: eventId },
      ],
    }),
    createLevel10Rock: builder.mutation({
      query: ({ eventId, occurrence_key, ...body }) => ({
        url: `/level10/events/${eventId}/rocks/`,
        method: "POST",
        body,
      }),
      transformResponse: (response) => unwrap(response),
      invalidatesTags: (_r, _e, { eventId }) => [
        { type: "Level10Meeting", id: eventId },
      ],
    }),
    updateLevel10Rock: builder.mutation({
      query: ({ eventId, rockId, occurrence_key, ...body }) => ({
        url: `/level10/events/${eventId}/rocks/${rockId}/`,
        method: "PATCH",
        body,
      }),
      transformResponse: (response) => unwrap(response),
      invalidatesTags: (_r, _e, { eventId }) => [
        { type: "Level10Meeting", id: eventId },
      ],
    }),
    deleteLevel10Rock: builder.mutation({
      query: ({ eventId, rockId, occurrence_key }) => ({
        url: `/level10/events/${eventId}/rocks/${rockId}/`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { eventId }) => [
        { type: "Level10Meeting", id: eventId },
      ],
    }),
    upsertLevel10RockStatus: builder.mutation({
      query: ({ eventId, rockId, ...body }) => ({
        url: `/level10/events/${eventId}/rocks/${rockId}/status/`,
        method: "PUT",
        body,
      }),
      transformResponse: (response) => unwrap(response),
      invalidatesTags: (_r, _e, { eventId }) => [
        { type: "Level10Meeting", id: eventId },
      ],
    }),
    createLevel10RockNote: builder.mutation({
      query: ({ eventId, rockId, occurrence_key, ...body }) => ({
        url: `/level10/events/${eventId}/rocks/${rockId}/notes/`,
        method: "POST",
        body,
      }),
      transformResponse: (response) => unwrap(response),
      invalidatesTags: (_r, _e, { eventId }) => [
        { type: "Level10Meeting", id: eventId },
      ],
    }),
    deleteLevel10RockNote: builder.mutation({
      query: ({ eventId, rockId, noteId, occurrence_key }) => ({
        url: `/level10/events/${eventId}/rocks/${rockId}/notes/${noteId}/`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { eventId }) => [
        { type: "Level10Meeting", id: eventId },
      ],
    }),
    createLevel10Headline: builder.mutation({
      query: ({ eventId, ...body }) => ({
        url: `/level10/events/${eventId}/headlines/`,
        method: "POST",
        body,
      }),
      transformResponse: (response) => unwrap(response),
      invalidatesTags: (_r, _e, { eventId, occurrence_key }) => [
        { type: "Level10Meeting", id: `${eventId}:${occurrence_key}` },
      ],
    }),
    deleteLevel10Headline: builder.mutation({
      query: ({ eventId, headlineId, occurrence_key }) => ({
        url: `/level10/events/${eventId}/headlines/${headlineId}/`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { eventId, occurrence_key }) => [
        { type: "Level10Meeting", id: `${eventId}:${occurrence_key}` },
      ],
    }),
    createLevel10Issue: builder.mutation({
      query: ({ eventId, occurrence_key, ...body }) => ({
        url: `/level10/events/${eventId}/issues/`,
        method: "POST",
        body: { occurrence_key, ...body },
      }),
      transformResponse: (response) => unwrap(response),
      invalidatesTags: (_r, _e, { eventId, occurrence_key }) => [
        { type: "Level10Meeting", id: `${eventId}:${occurrence_key}` },
      ],
    }),
    updateLevel10Issue: builder.mutation({
      query: ({ eventId, issueId, occurrence_key, ...body }) => ({
        url: `/level10/events/${eventId}/issues/${issueId}/`,
        method: "PATCH",
        body: { occurrence_key, ...body },
      }),
      transformResponse: (response) => unwrap(response),
      invalidatesTags: (_r, _e, { eventId, occurrence_key }) => [
        { type: "Level10Meeting", id: `${eventId}:${occurrence_key}` },
      ],
    }),
    deleteLevel10Issue: builder.mutation({
      query: ({ eventId, issueId, occurrence_key }) => ({
        url: `/level10/events/${eventId}/issues/${issueId}/`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { eventId, occurrence_key }) => [
        { type: "Level10Meeting", id: `${eventId}:${occurrence_key}` },
      ],
    }),
    upsertLevel10Rating: builder.mutation({
      query: ({ eventId, ...body }) => ({
        url: `/level10/events/${eventId}/ratings/`,
        method: "PUT",
        body,
      }),
      transformResponse: (response) => unwrap(response),
      invalidatesTags: (_r, _e, { eventId, occurrence_key }) => [
        { type: "Level10Meeting", id: `${eventId}:${occurrence_key}` },
      ],
    }),
  }),
});

export const {
  useGetLevel10EventsQuery,
  useGetLevel10EventQuery,
  useCreateLevel10EventMutation,
  useUpdateLevel10EventMutation,
  useDeleteLevel10EventMutation,
  useAddLevel10ExceptionMutation,
  useGetLevel10MeetingStateQuery,
  useUpsertLevel10TimerMutation,
  useCreateLevel10SegueMutation,
  useUpdateLevel10SegueMutation,
  useDeleteLevel10SegueMutation,
  useCreateLevel10MeasurableMutation,
  useUpdateLevel10MeasurableMutation,
  useDeleteLevel10MeasurableMutation,
  useUpsertLevel10MeasurableValueMutation,
  useCreateLevel10RockMutation,
  useUpdateLevel10RockMutation,
  useDeleteLevel10RockMutation,
  useUpsertLevel10RockStatusMutation,
  useCreateLevel10RockNoteMutation,
  useDeleteLevel10RockNoteMutation,
  useCreateLevel10HeadlineMutation,
  useDeleteLevel10HeadlineMutation,
  useCreateLevel10IssueMutation,
  useUpdateLevel10IssueMutation,
  useDeleteLevel10IssueMutation,
  useUpsertLevel10RatingMutation,
} = level10Api;
