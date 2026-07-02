import { baseApi, unwrap } from "./baseApi.js";
import { setAuthError, setSession, setSessionLoaded, setTokens } from "@/store/authSlice.js";
import { setIdentity } from "@/utils/session.js";

function applySession(dispatch, payload) {
  dispatch(setTokens({ access: payload.access, refresh: payload.refresh }));
  dispatch(setSession(payload.session));
  if (payload.session?.name || payload.session?.email) {
    setIdentity({
      name: payload.session.name ?? null,
      email: payload.session.email ?? null,
    });
  }
}

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    resolveSession: builder.mutation({
      query: (body) => ({
        url: "/auth/session/",
        method: "POST",
        body,
      }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          applySession(dispatch, unwrap(data));
        } catch (err) {
          const errors = err?.error?.data?.errors;
          const detail = Array.isArray(errors) ? errors[0]?.detail : null;
          dispatch(setAuthError(detail || "Unable to sign in"));
        }
      },
    }),
    getSessionMe: builder.query({
      query: () => "/auth/me/",
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(setSession(unwrap(data)));
        } catch {
          dispatch(setSessionLoaded(true));
        }
      },
    }),
    refreshToken: builder.mutation({
      query: (refresh) => ({
        url: "/auth/token/refresh/",
        method: "POST",
        body: { refresh },
      }),
      transformResponse: unwrap,
    }),
    healthCheck: builder.query({
      query: () => "/health/",
      transformResponse: unwrap,
    }),
  }),
});

export const {
  useResolveSessionMutation,
  useGetSessionMeQuery,
  useRefreshTokenMutation,
  useHealthCheckQuery,
} = authApi;
