import { useGetStatusesQuery } from "@/api/statusesApi.js";

export function useCustomStatuses(locationId) {
  const { data: statuses = [], isLoading, refetch } = useGetStatusesQuery(
    locationId ? { location_id: locationId } : undefined,
    { skip: !locationId },
  );
  return { statuses, loading: isLoading, reload: refetch };
}
