import { useState, useEffect, useRef, useMemo } from 'react';
import { Template } from '../types/rti';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Save, Plus, Move, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Pagination } from '../components/Pagination';
import { SmartEditor, SmartEditorRef } from '../components/SmartEditor';
import { RTI_VARIABLES } from '../utils/variableUtils';
import { useTemplates } from '../hooks/useTemplates'

export function Templates() {
  const [currentPage, setCurrentPage] = useState(1);
  const { 
    data, 
    isLoading, 
    isFetching, 
    createTemplate, 
    updateTemplate, 
    deleteTemplate: removeTemplate, 
    fetchTemplateContent,
    isCreating,
    isUpdating,
    isDeleting
  } = useTemplates(currentPage, 10);

  const [newTemplates, setNewTemplates] = useState<Template[]>([]);
  const [contentCache, setContentCache] = useState<Record<string, string>>({});
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [templateToDelete, setTemplateToDelete] = useState<{ id: string, title: string } | null>(null);

  const editorRef = useRef<SmartEditorRef>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');

  const sidebarItems = useMemo(() => {
    if (!data?.data) return newTemplates;
    return [
      ...newTemplates,
      ...data.data.map(dt => ({
        ...dt,
        content: contentCache[dt.id] ?? dt.content
      }))
    ];
  }, [data, newTemplates, contentCache]);

  const pagination = data?.pagination || { page: 1, totalPages: 1, totalItems: 0, pageSize: 10 };

  useEffect(() => {
    if (selectedTemplate) {
      const exists = sidebarItems.find(t => t.id === selectedTemplate.id);
      if (!exists && sidebarItems.length > 0 && !isLoading && !isFetching) {
        setSelectedTemplate(sidebarItems[0]);
      } else if (exists && (exists.title !== selectedTemplate.title || exists.content !== selectedTemplate.content)) {
        setSelectedTemplate(exists);
      }
    } else if (sidebarItems.length > 0 && !isLoading && !isFetching) {
      // No selection at all, pick first
      setSelectedTemplate(sidebarItems[0]);
    }
  }, [sidebarItems, isLoading, selectedTemplate]);


  // Sync editor when template changes
  useEffect(() => {
    const loadContent = async () => {
      if (selectedTemplate) {
        let content = selectedTemplate.content;

        // load the file content from the service if haven't already fetched it
        if (content === undefined && selectedTemplate.file && !selectedTemplate.id.startsWith('new-')) {
          try {
            content = await fetchTemplateContent(selectedTemplate.file);

            // Cache the content
            setContentCache(prev => ({ ...prev, [selectedTemplate.id]: content! }));
            setSelectedTemplate(prev => prev && prev.id === selectedTemplate.id ? { ...prev, content: content } : prev);
          } catch (e) {
            console.error("Failed to load file content:", e);
            content = '';
          }
        }

        if (editorRef.current && content !== undefined) {
          editorRef.current.setMarkdown(content || '');
        }
        setEditedName(selectedTemplate.title);
      }
    };
    loadContent();
  }, [selectedTemplate?.id]);


  const handleSelect = (template: Template | null) => {
    setSelectedTemplate(template);
  };


  const addNewTemplate = () => {
    const newTemplate: Template = {
      id: `new-${Date.now()}`,
      title: 'Untitled Template',
      description: 'New template',
      file: '',
      content: '',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    setNewTemplates([newTemplate, ...newTemplates]);
    setSelectedTemplate(newTemplate);
    if (editorRef.current) {
      editorRef.current.setMarkdown('');
    }
  };

  const saveTemplate = async () => {
    if (!editorRef.current || !selectedTemplate) return;
    const markdown = editorRef.current.getMarkdown();
    const isNew = selectedTemplate.id.startsWith('new-');

    const savePromise = (async () => {
      let savedTemplate: Template;

      if (isNew) {
        savedTemplate = await createTemplate({
          title: editedName,
          description: selectedTemplate.description || '',
          content: markdown,
          file: '',
          createdAt: new Date(),
          updatedAt: new Date()
        });
      } else {
        savedTemplate = await updateTemplate({
          id: selectedTemplate.id,
          updates: { title: editedName, content: markdown }
        });
      }
      return savedTemplate;
    })();

    toast.promise(savePromise, {
      loading: isNew ? 'Creating template...' : 'Saving template...',
      success: isNew ? 'New template created!' : 'Template updated!',
      error: 'Failed to save template',
    });

    try {
      const savedTemplate = await savePromise;

      // Use the content we just saved if the backend didn't return it for some reason
      if (savedTemplate.content === undefined) {
        savedTemplate.content = markdown;
      }

      // Update our local content cache
      setContentCache(prev => ({ ...prev, [savedTemplate.id]: markdown }));

      if (isNew) {
        setNewTemplates(prev => prev.filter(t => t.id !== selectedTemplate.id));
      }

      setSelectedTemplate(savedTemplate);
      setIsEditingName(false);
    } catch (error) {
      console.error('Save error:', error);
    }
  };


  const deleteTemplate = (id: string, title: string) => {
    setTemplateToDelete({ id, title });
  };

  const confirmDelete = async () => {
    if (!templateToDelete) return;

    const idToDelete = templateToDelete.id;
    const isNew = idToDelete.startsWith('new-');
    setTemplateToDelete(null);

    const deletePromise = (async () => {
      if (!isNew) {
        await removeTemplate(idToDelete);
      }
    })();

    if (!isNew) {
      toast.promise(deletePromise, {
        loading: 'Deleting template...',
        success: 'Template deleted',
        error: 'Failed to delete template',
      });
    } else {
      toast.success('Template deleted');
    }

    try {
      await deletePromise;

      const isDeletingSelected = selectedTemplate?.id === idToDelete;
      if (isDeletingSelected) setSelectedTemplate(null);

      // Cleanup local state
      setNewTemplates(prev => prev.filter(t => t.id !== idToDelete));
      setContentCache(prev => {
        const next = { ...prev };
        delete next[idToDelete];
        return next;
      });
    } catch (error) {
      console.error('Delete error:', error);
    }
  };


  const onDragStart = (e: React.DragEvent, variable: any) => {
    e.dataTransfer.setData('application/json', JSON.stringify(variable));
  };

  const insertVariableAtCursor = (variable: any) => {
    editorRef.current?.insertVariable(variable.code, variable.name);
  };

  return (
    <div className="flex flex-col space-y-4 lg:h-[calc(100vh-4rem)]">
      <div className="flex flex-wrap justify-between items-end gap-4">
        <div className="min-w-[200px]">
          <h1 className="text-2xl font-bold text-gray-900">RTI Template Manager</h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage RTI templates for RTI generation.
          </p>
        </div>
        {(pagination.totalItems > 0 || newTemplates.length > 0) && (
          <Button onClick={addNewTemplate} className="flex items-center gap-2 whitespace-nowrap flex-shrink-0">
            <Plus className="w-4 h-4" /> New Template
          </Button>
        )}
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-4 lg:overflow-hidden">
        {/* Sidebar */}
        {(pagination.totalItems > 0 || newTemplates.length > 0) && (
          <div className="w-full lg:w-60 h-80 lg:h-auto flex flex-col bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex-shrink-0">
            <div className="p-3 border-b border-gray-200 bg-gray-50/50 font-semibold text-xs uppercase tracking-wider text-gray-500">
              Saved Templates
            </div>
            <div className="flex-1 overflow-y-auto">
              {sidebarItems.length > 0 ? (
                sidebarItems.map((template: Template) => (
                  <div key={template.id} className="group relative">
                    <button
                      onClick={() => handleSelect(template)}
                      className={`w-full text-left p-4 border-b border-gray-100 text-sm transition-all relative ${selectedTemplate?.id === template.id
                        ? 'bg-blue-50 text-blue-900 font-medium'
                        : 'hover:bg-gray-50 text-gray-600'
                        }`}
                    >
                      {selectedTemplate?.id === template.id && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600" />
                      )}
                      {template.title}
                    </button>
                    <button
                      disabled={isDeleting}
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteTemplate(template.id, template.title);
                      }}
                      className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all ${isDeleting ? 'cursor-not-allowed opacity-50' : ''}`}
                    >
                      <Trash2 className={`w-4 h-4 ${isDeleting && templateToDelete?.id === template.id ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-xs text-gray-400 italic">
                  No templates on this page
                </div>
              )}
            </div>
            {/* Pagination Controls */}
            <div className="p-3 border-t border-gray-100 bg-gray-50/30">
              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                onPageChange={(nextPage) => setCurrentPage(nextPage)}
                variant="simple"
                loading={isLoading || isFetching}
              />

            </div>
          </div>
        )}

        {/* Smart Editor or Empty State */}
        <div className="flex-1 min-h-[600px] lg:min-h-0 flex flex-col bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden relative">
          {(pagination.totalItems > 0 || newTemplates.length > 0) && selectedTemplate ? (
            <>
              <div className="p-3 border-b border-gray-200 bg-white flex flex-wrap justify-between items-center gap-2 z-10">
                <div className="flex items-center gap-2 flex-1 min-w-[150px]">
                  {isEditingName ? (
                    <input
                      autoFocus
                      className="text-sm font-semibold text-gray-700 bg-gray-50 px-2 py-1 rounded border border-blue-200 focus:outline-none"
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      onBlur={() => setIsEditingName(false)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') setIsEditingName(false);
                        if (e.key === 'Escape') {
                          setEditedName(selectedTemplate.title);
                          setIsEditingName(false);
                        }
                      }}
                    />
                  ) : (
                    <span
                      data-testid="template-title-span"
                      onClick={() => setIsEditingName(true)}
                      className="font-semibold text-sm text-gray-700 cursor-pointer hover:bg-gray-50 px-2 py-1 rounded"
                    >
                      {editedName || selectedTemplate.title}
                    </span>
                  )}
                </div>
                <Button 
                  size="sm" 
                  variant="primary" 
                  onClick={saveTemplate} 
                  loading={isCreating || isUpdating}
                  className="flex items-center gap-2 whitespace-nowrap flex-shrink-0"
                >
                  <Save className="w-4 h-4" /> Save Template
                </Button>
              </div>

              <SmartEditor
                ref={editorRef}
                initialMarkdown={selectedTemplate.content}
                placeholderText="Start typing your template here..."
                className="flex-1"
              />

            </>
          ) : isLoading && !data ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gray-50/50">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-500 text-sm">Loading templates...</p>
            </div>
          ) : (pagination.totalItems > 0 || newTemplates.length > 0) ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gray-50/50 text-gray-500">
              Select a template from the sidebar to start editing.
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gray-50/50">
              <p className="text-gray-500 mb-4 max-w-sm">
                Get started by creating a new template.
              </p>
              <Button onClick={addNewTemplate} className="flex items-center gap-2 whitespace-nowrap flex-shrink-0">
                <Plus className="w-4 h-4" /> Create Template
              </Button>
            </div>
          )}
        </div>

        {/* Variables */}
        {(pagination.totalItems > 0 || newTemplates.length > 0) && (
          <div className="w-full lg:w-60 h-[350px] lg:h-auto flex flex-col bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex-shrink-0">
            <div className="p-3 border-b border-gray-200 bg-gray-50/50 font-semibold text-xs uppercase tracking-wider text-gray-500">
              Variables
            </div>
            <div className="p-4 bg-blue-50/50 border-b border-blue-100">
              <p className="text-[11px] text-blue-700 leading-tight">
                <strong>Tip:</strong> Click a variable to insert it at your cursor, or drag and drop it into the editor.
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {RTI_VARIABLES.map((v) => (
                <div
                  key={v.name}
                  draggable
                  onDragStart={(e) => onDragStart(e, v)}
                  onClick={() => insertVariableAtCursor(v)}
                  className="group cursor-pointer bg-white border border-gray-200 rounded-lg p-3 hover:border-blue-400 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center gap-2">
                    <div className="p-1 bg-blue-50 rounded text-blue-600">
                      <Move className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-sm font-bold text-gray-900">{v.name}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{v.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!templateToDelete}
        title="Delete Template?"
        message={`Are you sure you want to delete "${templateToDelete?.title}"? This action cannot be undone.`}
        onCancel={() => setTemplateToDelete(null)}
        onConfirm={confirmDelete}
        confirmText="Delete Template"
        loading={isDeleting}
      />
    </div>
  );
}