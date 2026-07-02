import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { authApi, useResolveSessionMutation } from "@/api/authApi.js";
import { setSessionLoaded } from "@/store/authSlice.js";
import { isAdminPath, loadTokens, readAdminKey, readUrlParams } from "@/utils/session.js";

export function SessionInitializer({ children }) {
  const dispatch = useDispatch();
  const [resolveSession] = useResolveSessionMutation();

  useEffect(() => {
    const params = readUrlParams();
    const hasGhlLogin = params.ghl_location_id && (params.email || params.ghl_user_id);
    const adminKey = isAdminPath() ? readAdminKey() : null;
    const tokens = loadTokens();

    if (hasGhlLogin) {
      resolveSession({
        ghl_location_id: params.ghl_location_id,
        ghl_user_id: params.ghl_user_id,
        email: params.email,
      });
      return;
    }

    if (adminKey) {
      resolveSession({ admin_key: adminKey });
      return;
    }

    if (tokens.access) {
      dispatch(authApi.endpoints.getSessionMe.initiate(undefined, { forceRefetch: true }));
      return;
    }

    dispatch(setSessionLoaded(true));
  }, [dispatch, resolveSession]);

  return children;
}
