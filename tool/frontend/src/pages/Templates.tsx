import { useState, useEffect, useRef } from 'react';
import { mockTemplates } from '../data/mockData';
import { Template } from '../types/rti';
import { Button } from '../components/Button';
import { Save, Plus, Move, Trash2, X } from 'lucide-react';

export function Templates() {
  const [templates, setTemplates] = useState<Template[]>(mockTemplates);
  const [selectedTemplate, setSelectedTemplate] = useState<Template>(
    mockTemplates[0]
  );
  
  const editorRef = useRef<HTMLDivElement>(null);

  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(mockTemplates[0].name);

  const variables = [
    { name: 'date', code: '{{date}}', desc: 'Current Date' },
    { name: 'sender_name', code: '{{sender_name}}', desc: 'Applicant Name' },
    { name: 'receiver_name', code: '{{receiver_name}}', desc: 'Institution Name' },
    { name: 'receiver_position', code: '{{receiver_position}}', desc: 'Target Position' },
    { name: 'reference_id', code: '{{reference_id}}', desc: 'Auto-generated ID' }
  ];

  // Helper to create a pill element
  const createPillHtml = (code: string, name: string) => {
    return `<span class="pill-chip inline-flex items-center gap-1 pl-2 pr-1 py-0.5 border border-blue-200 rounded mx-0.5 bg-blue-100 text-blue-800 text-xs font-semibold align-baseline cursor-default select-none" data-code="${code}" contenteditable="false">${name}<span class="pill-remove hover:bg-blue-300 rounded px-1 cursor-pointer opacity-80 hover:opacity-100 transition-opacity flex items-center justify-center font-bold ml-0.5" onclick="this.parentElement.remove()">×</span></span>`;
  };

  // Convert Markdown to HTML with pills
  const parseMarkdownToHtml = (markdown: string) => {
    return markdown.replace(/{{([^}]+)}}/g, (match, p1) => {
      const name = p1.replace(/_/g, ' ');
      return createPillHtml(match, name);
    });
  };

  // Convert HTML back to Markdown
  const serializeHtmlToMarkdown = (html: string) => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    // Replace pill spans with their data-code attribute
    const pills = tempDiv.querySelectorAll('.pill-chip');
    pills.forEach((pill) => {
      const code = pill.getAttribute('data-code');
      pill.replaceWith(code || '');
    });

    // Handle newlines: innerText preserves them better than textContent
    return tempDiv.innerText || tempDiv.textContent || '';
  };

  // Sync editor when template changes
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = parseMarkdownToHtml(selectedTemplate.content);
    }
    setEditedName(selectedTemplate.name);
  }, [selectedTemplate]);

  const handleSelect = (template: Template) => {
    setSelectedTemplate(template);
  };

  const addNewTemplate = () => {
    const newTemplate: Template = {
      id: `t-${Date.now()}`,
      name: 'Untitled Template',
      description: 'New template',
      content: ''
    };
    setTemplates([newTemplate, ...templates]);
    setSelectedTemplate(newTemplate);
  };

  const saveTemplate = () => {
    if (!editorRef.current) return;
    const markdown = serializeHtmlToMarkdown(editorRef.current.innerHTML);
    const updatedTemplates = templates.map((t: Template) =>
      t.id === selectedTemplate.id
        ? { ...t, content: markdown, name: editedName }
        : t
    );
    setTemplates(updatedTemplates);
    setSelectedTemplate({
      ...selectedTemplate,
      content: markdown,
      name: editedName
    });
    setIsEditingName(false);
    alert('Template saved successfully!');
  };

  const deleteTemplate = (id: string) => {
    if (templates.length <= 1) return;
    if (confirm('Delete this template?')) {
      const remaining = templates.filter((t: Template) => t.id !== id);
      setTemplates(remaining);
      if (selectedTemplate.id === id) handleSelect(remaining[0]);
    }
  };

  const onDragStart = (e: React.DragEvent, variable: any) => {
    e.dataTransfer.setData('application/json', JSON.stringify(variable));
  };

  const insertHtmlAtSelection = (html: string, selection: Selection | null) => {
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    
    // Check if the user dropped inside an existing pill
    let container = range.startContainer;
    if (container.nodeType === Node.TEXT_NODE) {
      container = container.parentNode as Element;
    }
    const closestPill = (container as Element)?.closest?.('.pill-chip');
    if (closestPill) {
      range.setStartAfter(closestPill);
      range.collapse(true);
    }

    // Create a temporary container for our new HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    const fragment = document.createDocumentFragment();
    let node;
    while ((node = tempDiv.firstChild)) {
      fragment.appendChild(node);
    }
    
    // Make sure we have a text node (an invisible zero-width character) to place the cursor onto
    const spaceNode = document.createTextNode('\u200B');
    fragment.appendChild(spaceNode);
    
    range.deleteContents(); // Deletes any text the user currently has highlighted
    range.insertNode(fragment);// Inserts the new variable
    
    // Force the cursor position right after the space node
    range.setStartAfter(spaceNode);
    range.setEndAfter(spaceNode);
    selection.removeAllRanges();
    selection.addRange(range);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('application/json');
    if (!data) return;
    
    const variable = JSON.parse(data);
    const pillHtml = createPillHtml(variable.code, variable.name);

    let range: Range | null = null;

    // Use standard caretPositionFromPoint if available (Firefox)
    // @ts-ignore - Type definitions might not include this yet
    if (document.caretPositionFromPoint) {
      // @ts-ignore
      const pos = document.caretPositionFromPoint(e.clientX, e.clientY);
      if (pos) {
        range = document.createRange();
        range.setStart(pos.offsetNode, pos.offset);
        range.collapse(true);
      }
    } 
    // Fallback to older webkit/blink way (Chrome/Edge/Safari)
    // @ts-ignore
    else if (document.caretRangeFromPoint) {
      // @ts-ignore
      range = document.caretRangeFromPoint(e.clientX, e.clientY);
    }

    if (range) {
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      insertHtmlAtSelection(pillHtml, window.getSelection());
    }
  };

  const insertVariableAtCursor = (variable: any) => {
    const pillHtml = createPillHtml(variable.code, variable.name);
    editorRef.current?.focus();
    insertHtmlAtSelection(pillHtml, window.getSelection());
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col space-y-4">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Template Manager</h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage Markdown templates for RTI generation.
          </p>
        </div>
        <Button onClick={addNewTemplate} className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Template
        </Button>
      </div>

      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 flex flex-col bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex-shrink-0">
          <div className="p-3 border-b border-gray-200 bg-gray-50/50 font-semibold text-xs uppercase tracking-wider text-gray-500">
            Saved Templates
          </div>
          <div className="flex-1 overflow-y-auto">
            {templates.map((template: Template) => (
              <div key={template.id} className="group relative">
                <button
                  onClick={() => handleSelect(template)}
                  className={`w-full text-left p-4 border-b border-gray-100 text-sm transition-all relative ${
                    selectedTemplate.id === template.id
                      ? 'bg-blue-50 text-blue-900 font-medium'
                      : 'hover:bg-gray-50 text-gray-600'
                  }`}
                >
                  {selectedTemplate.id === template.id && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600" />
                  )}
                  {template.name}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteTemplate(template.id);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Smart Editor */}
        <div className="flex-1 flex flex-col bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden relative">
          <div className="p-3 border-b border-gray-200 bg-white flex justify-between items-center z-10">
            <div className="flex items-center gap-2 flex-1">
              {isEditingName ? (
                <input
                  autoFocus
                  className="text-sm font-semibold text-gray-700 bg-gray-50 px-2 py-1 rounded border border-blue-200 focus:outline-none"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  onBlur={() => setIsEditingName(false)}
                />
              ) : (
                <span
                  onClick={() => setIsEditingName(true)}
                  className="font-semibold text-sm text-gray-700 cursor-pointer hover:bg-gray-50 px-2 py-1 rounded"
                >
                  {editedName}
                </span>
              )}
            </div>
            <Button size="sm" variant="primary" onClick={saveTemplate} className="flex items-center gap-2">
              <Save className="w-4 h-4" /> Save Template
            </Button>
          </div>
          
          <div 
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
            className="flex-1 p-8 bg-white overflow-y-auto outline-none text-[16px] text-gray-800 leading-relaxed white-space-pre-wrap cursor-text empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400 empty:before:pointer-events-none empty:before:italic"
            style={{ whiteSpace: 'pre-wrap' }}
            data-placeholder="Start typing your template here..."
          />
        </div>

        {/* Variables */}
        <div className="w-72 flex flex-col bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex-shrink-0">
          <div className="p-3 border-b border-gray-200 bg-gray-50/50 font-semibold text-xs uppercase tracking-wider text-gray-500">
            Variables
          </div>
          <div className="p-4 bg-blue-50/50 border-b border-blue-100">
            <p className="text-[11px] text-blue-700 leading-tight">
              <strong>Tip:</strong> Click a variable to insert it at your cursor, or drag and drop it into the editor.
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {variables.map((v) => (
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
      </div>
    </div>
  );
}