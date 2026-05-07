import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAsgardeo } from '@asgardeo/react';
import { rtiRequestHistoryService } from '../services/rtiRequestHistoryService';
import toast from 'react-hot-toast';

/**
 * Hook to fetch history for a specific RTI request.
 */
export function useRtiRequestHistories(rtiRequestId: string, page: number = 1, pageSize: number = 100) {
  const { http, isSignedIn } = useAsgardeo();
  return useQuery({
    queryKey: ['rti-requests', rtiRequestId, 'histories', { page, pageSize }],
    queryFn: () => rtiRequestHistoryService.getHistories(rtiRequestId, page, pageSize, http),
    enabled: !!rtiRequestId && !!isSignedIn,
  });
}

/**
 * Hook to create a new RTI request history entry.
 */
export function useCreateRtiRequestHistory() {
  const { http } = useAsgardeo();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ rtiRequestId, payload }: { 
      rtiRequestId: string, 
      payload: {
        statusId: string;
        direction: 'sent' | 'received';
        entryTime?: Date | string;
        exitTime?: Date | string;
        description?: string;
        files?: File[];
      } 
    }) => rtiRequestHistoryService.createHistory(rtiRequestId, payload, http),
    onSuccess: (_, { rtiRequestId }) => {
      queryClient.invalidateQueries({ queryKey: ['rti-requests', rtiRequestId, 'histories'] });
      queryClient.invalidateQueries({ queryKey: ['rti-requests', rtiRequestId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to add event');
    }
  });
}

/**
 * Hook to update an existing RTI request history entry.
 */
export function useUpdateRtiRequestHistory() {
  const { http } = useAsgardeo();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ rtiRequestId, historyId, payload }: { 
      rtiRequestId: string, 
      historyId: string, 
      payload: {
        statusId?: string;
        direction?: 'sent' | 'received';
        entryTime?: Date | string;
        exitTime?: Date | string;
        description?: string;
        filesToAdd?: File[];
        filesToDelete?: string[];
      } 
    }) => rtiRequestHistoryService.updateHistory(rtiRequestId, historyId, payload, http),
    onSuccess: (_, { rtiRequestId }) => {
      queryClient.invalidateQueries({ queryKey: ['rti-requests', rtiRequestId, 'histories'] });
      queryClient.invalidateQueries({ queryKey: ['rti-requests', rtiRequestId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update event');
    }
  });
}

/**
 * Hook to delete an RTI request history entry.
 */
export function useDeleteRtiRequestHistory() {
  const { http } = useAsgardeo();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ rtiRequestId, historyId }: { rtiRequestId: string, historyId: string }) =>
      rtiRequestHistoryService.deleteHistory(rtiRequestId, historyId, http),
    onSuccess: (_, { rtiRequestId }) => {
      queryClient.invalidateQueries({ queryKey: ['rti-requests', rtiRequestId, 'histories'] });
      queryClient.invalidateQueries({ queryKey: ['rti-requests', rtiRequestId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete event');
    }
  });
}
