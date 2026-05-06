import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { templateService } from '../services/templateService';
import { useAsgardeo } from '@asgardeo/react';
import { Template } from '../types/rti';
import { ListResponse } from '../types/api';
import { useCallback } from 'react';

export const useTemplates = (page: number = 1, pageSize: number = 10) => {
  const { http, isSignedIn } = useAsgardeo();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['templates', page, pageSize],
    queryFn: () => templateService.getRTITemplates(page, pageSize, http),
    enabled: !!isSignedIn,
    placeholderData: keepPreviousData,
  });

  const createTemplateMutation = useMutation({
    mutationFn: (template: Omit<Template, 'id'>) => templateService.createRTITemplate(template, http),
    onSuccess: (newTemplate) => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      // Update cache for individual template query if it exists
      queryClient.setQueryData(['template', newTemplate.id], newTemplate);
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string, updates: Partial<Template> }) => templateService.updateRTITemplate(id, updates, http),
    onSuccess: (updatedTemplate) => {
      // 1. Update the individual template query cache
      queryClient.setQueryData(['template', updatedTemplate.id], updatedTemplate);

      // 2. Update the template in any cached list queries
      queryClient.setQueriesData({ queryKey: ['templates'] }, (oldData: ListResponse<Template> | undefined) => {
        if (!oldData || !oldData.data) return oldData;
        return {
          ...oldData,
          data: oldData.data.map((t: Template) => t.id === updatedTemplate.id ? { ...t, ...updatedTemplate } : t)
        };
      });

      // 3. Invalidate to ensure sync with backend
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (id: string) => templateService.deleteRTITemplate(id, http),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      queryClient.removeQueries({ queryKey: ['template', deletedId] });
    },
  });

  const fetchTemplateContent = useCallback(
    (filePath: string) => templateService.getTemplateContent(filePath),
    []
  );

  const fetchTemplateById = useCallback(
    (id: string) => templateService.getRTITemplateById(id, http),
    [http]
  );

  return {
    ...query,
    createTemplate: createTemplateMutation.mutateAsync,
    updateTemplate: updateTemplateMutation.mutateAsync,
    deleteTemplate: deleteTemplateMutation.mutateAsync,
    fetchTemplateContent,
    fetchTemplateById,
  };
};

export const useTemplate = (id?: string) => {
  const { http, isSignedIn } = useAsgardeo();

  return useQuery({
    queryKey: ['template', id],
    queryFn: () => {
      if (!id) throw new Error("Template ID is required");
      return templateService.getRTITemplateById(id, http);
    },
    enabled: !!isSignedIn && !!id,
  });
};
