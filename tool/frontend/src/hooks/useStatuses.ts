import { useQuery } from '@tanstack/react-query';
import { useAsgardeo } from '@asgardeo/react';
import { statusService } from '../services/statusService';

/**
 * Hook to fetch all RTI statuses from the backend.
 */
export function useStatuses() {
  const { http } = useAsgardeo();

  return useQuery({
    queryKey: ['rti-statuses'],
    queryFn: () => statusService.getAll(http),
    enabled: !!http,
    staleTime: 1000 * 60 * 5,
  });
}
