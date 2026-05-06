import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAsgardeo } from '@asgardeo/react';

export function useEntityData<T>(
  queryKey: string,
  serviceFns: {
    list: (page: number, pageSize: number, search?: string, http?: any) => Promise<any>;
    create?: (data: any, http?: any) => Promise<any>;
    update?: (id: string, data: any, http?: any) => Promise<any>;
    delete?: (id: string, http?: any) => Promise<any>;
  },
  page: number = 1,
  pageSize: number = 10,
  search?: string
) {
  const { http, isSignedIn } = useAsgardeo();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [queryKey, page, pageSize, search],
    queryFn: () => serviceFns.list(page, pageSize, search, http),
    enabled: !!isSignedIn,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => serviceFns.create!(data, http),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [queryKey] }),
    retry: 0,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string, data: any }) => serviceFns.update!(id, data, http),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [queryKey] }),
    retry: 0,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => serviceFns.delete!(id, http),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [queryKey] }),
    retry: 0,
  });

  return {
    ...query,
    data: query.data?.data || [],
    pagination: query.data?.pagination || { page: 1, pageSize: 10, totalPages: 1, totalItems: 0 },
    confirmCreate: createMutation.mutateAsync,
    confirmUpdate: (id: string, data: any) => updateMutation.mutateAsync({ id, data }),
    confirmDelete: deleteMutation.mutateAsync,
    isMutating: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
  };
}