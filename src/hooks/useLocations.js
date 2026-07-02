import { useGetLocationsQuery } from "@/api/locationsApi.js";
import { useSession } from "@/hooks/useSession.js";

export function useLocations() {
  const session = useSession();
  const { data: locations = [], isLoading } = useGetLocationsQuery();

  const locked = session.locationLocked;
  const lockedLocationRowId = session.locationRowId;

  return {
    locations,
    isLoading,
    locked,
    lockedLocationRowId,
  };
}
