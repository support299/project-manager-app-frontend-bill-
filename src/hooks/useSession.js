import { useSelector } from "react-redux";
import { selectAuth } from "@/store/authSlice.js";

export function useSession() {
  const auth = useSelector(selectAuth);
  return {
    loaded: auth.loaded,
    locationRowId: auth.session?.location_row_id ?? null,
    ghlLocationId: auth.session?.ghl_location_id ?? null,
    ghlUserId: auth.session?.ghl_user_id ?? null,
    role: auth.session?.role ?? null,
    name: auth.session?.name ?? null,
    email: auth.session?.email ?? null,
    locationLocked: auth.session?.location_locked ?? false,
    isAdmin: auth.session?.is_admin ?? false,
    isSuperAdmin: auth.session?.is_super_admin ?? false,
    isAnonymous: auth.session?.is_anonymous ?? false,
  };
}
