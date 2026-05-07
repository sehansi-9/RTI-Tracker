import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAsgardeo } from '@asgardeo/react';
import { rtiRequestsService } from '../services/rtiRequestsService';

export function useRTIRequestList(page: number = 1, pageSize: number = 10, search?: string) {
  const { http, isSignedIn } = useAsgardeo();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['rti-requests', page, pageSize, search],
    queryFn: () => rtiRequestsService.list(page, pageSize, search, http),
    enabled: !!isSignedIn,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => rtiRequestsService.remove(id, http),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rti-requests'] });
    },
  });

  return {
    ...query,
    data: query.data?.data || [],
    pagination: query.data?.pagination || { page: 1, pageSize: 10, totalPages: 1, totalItems: 0 },
    confirmDelete: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
}
