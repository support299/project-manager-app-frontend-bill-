import { baseApi, unwrap } from "./baseApi.js";

export const locationsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getLocations: builder.query({
      query: () => "/locations/",
      transformResponse: unwrap,
      providesTags: [{ type: "Location", id: "LIST" }],
    }),
    createLocation: builder.mutation({
      query: (body) => ({ url: "/locations/", method: "POST", body }),
      transformResponse: unwrap,
      invalidatesTags: [{ type: "Location", id: "LIST" }],
    }),
    updateLocation: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/locations/${id}/`, method: "PATCH", body }),
      transformResponse: unwrap,
      invalidatesTags: [{ type: "Location", id: "LIST" }],
    }),
    deleteLocation: builder.mutation({
      query: (id) => ({ url: `/locations/${id}/`, method: "DELETE" }),
      invalidatesTags: [{ type: "Location", id: "LIST" }],
    }),
    testLocation: builder.mutation({
      query: (id) => ({ url: `/locations/${id}/test/`, method: "POST" }),
      transformResponse: unwrap,
    }),
    syncLocationUsers: builder.mutation({
      query: ({ id, async = false }) => ({
        url: `/locations/${id}/sync-users/`,
        method: "POST",
        params: async ? { async: "true" } : undefined,
      }),
      transformResponse: unwrap,
      invalidatesTags: [{ type: "User", id: "LIST" }],
    }),
    syncAllLocationUsers: builder.mutation({
      query: () => ({ url: "/locations/sync-all-users/", method: "POST" }),
      transformResponse: unwrap,
    }),
    getSyncAllLocationUsersStatus: builder.query({
      query: (taskId) => ({
        url: "/locations/sync-all-users/",
        params: { task_id: taskId },
      }),
      transformResponse: unwrap,
    }),
    getLocationUsers: builder.query({
      query: (id) => `/locations/${id}/users/`,
      transformResponse: unwrap,
      providesTags: [{ type: "User", id: "LIST" }],
    }),
    setUserRole: builder.mutation({
      query: ({ locationId, ghlId, role }) => ({
        url: `/locations/${locationId}/users/${ghlId}/role/`,
        method: "PATCH",
        body: { role },
      }),
      transformResponse: unwrap,
      invalidatesTags: [{ type: "User", id: "LIST" }],
    }),
    searchGhlContacts: builder.mutation({
      query: (body) => ({ url: "/ghl/contacts/search/", method: "POST", body }),
      transformResponse: unwrap,
    }),
    searchGhlUsers: builder.mutation({
      query: (body) => ({ url: "/ghl/users/search/", method: "POST", body }),
      transformResponse: unwrap,
    }),
    cacheGhlContact: builder.mutation({
      query: (body) => ({ url: "/ghl/contacts/cache/", method: "POST", body }),
      transformResponse: unwrap,
    }),
    cacheGhlUser: builder.mutation({
      query: (body) => ({ url: "/ghl/users/cache/", method: "POST", body }),
      transformResponse: unwrap,
    }),
    getGhlUsers: builder.query({
      query: (params) => ({ url: "/ghl/users/", params }),
      transformResponse: unwrap,
    }),
  }),
});

export const {
  useGetLocationsQuery,
  useCreateLocationMutation,
  useUpdateLocationMutation,
  useDeleteLocationMutation,
  useTestLocationMutation,
  useSyncLocationUsersMutation,
  useSyncAllLocationUsersMutation,
  useLazyGetSyncAllLocationUsersStatusQuery,
  useGetLocationUsersQuery,
  useSetUserRoleMutation,
  useSearchGhlContactsMutation,
  useSearchGhlUsersMutation,
  useCacheGhlContactMutation,
  useCacheGhlUserMutation,
  useGetGhlUsersQuery,
} = locationsApi;
