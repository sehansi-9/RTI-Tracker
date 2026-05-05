import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { templateService } from '../services/templateService';
import { useAsgardeo } from '@asgardeo/react';
import { Template } from '../types/rti';
import { useCallback } from 'react';

export const useTemplates = (page: number = 1, pageSize: number = 10) => {
  const { http, isSignedIn } = useAsgardeo();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['templates', page, pageSize],
    queryFn: () => templateService.getRTITemplates(page, pageSize, http),
    enabled: !!isSignedIn,
  });

  const createTemplateMutation = useMutation({
    mutationFn: (template: Omit<Template, 'id'>) => templateService.createRTITemplate(template, http),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string, updates: Partial<Template> }) => templateService.updateRTITemplate(id, updates, http),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (id: string) => templateService.deleteRTITemplate(id, http),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
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
