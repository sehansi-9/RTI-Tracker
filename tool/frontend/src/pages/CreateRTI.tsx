import { useState, Fragment, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { mockTemplates, mockSenders, mockReceivers } from '../data/mockData';
import { FileText, ArrowRight, Save, Send, ChevronLeft, User } from 'lucide-react';
import { SmartEditor, SmartEditorRef } from '../components/SmartEditor';

export function CreateRTI() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const editorRef = useRef<SmartEditorRef>(null);

  const [formData, setFormData] = useState({
    templateId: '',
    title: '',
    description: '',
    senderId: '',
    receiverId: '',
    content: '',
    requestDate: new Date().toISOString().split('T')[0]
  });

  const handleTemplateSelect = (templateId: string, content: string, title: string) => {
    setFormData({
      ...formData,
      templateId,
      content: content || '',
      title: title
    });
    setStep(2);
  };

  const placeholders = useMemo(() => {
    const sender = mockSenders.find(s => s.id === formData.senderId);
    const receiver = mockReceivers.find(r => r.id === formData.receiverId);

    return {
      '{{date}}': formData.requestDate,
      '{{sender_name}}': sender?.name || 'Sender Name',
      '{{sender_email}}': sender?.email || 'Sender Email',
      '{{sender_address}}': sender?.address || 'Sender Address',
      '{{sender_contact_no}}': sender?.contactNo || 'Sender Contact No',
      '{{receiver_institution}}': receiver?.institutionName || 'Institution',
      '{{receiver_position}}': receiver?.positionName || 'Position',
      '{{receiver_email}}': receiver?.email || 'Receiver Email',
      '{{receiver_address}}': receiver?.address || 'Receiver Address',
      '{{receiver_contact_no}}': receiver?.contactNo || 'Receiver Contact No',
    };
  }, [formData.senderId, formData.receiverId, formData.requestDate]);

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-12">
      {[1, 2, 3].map((num) => (
        <Fragment key={num}>
          <div className="flex flex-col items-center relative">
            <div
              className={`
                w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-300
                ${step === num
                  ? 'bg-blue-900 text-white border-blue-900 shadow-lg scale-110'
                  : step > num
                    ? 'bg-green-500 text-white border-green-500'
                    : 'bg-white text-gray-400 border-gray-200'}
              `}
            >
              {step > num ? '✓' : num}
            </div>
            <span className={`absolute -bottom-7 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap ${step === num ? 'text-blue-900' : 'text-gray-400'}`}>
              {num === 1 ? 'Template' : num === 2 ? 'Details' : 'Finalize'}
            </span>
          </div>
          {num < 3 && (
            <div className={`w-24 h-0.5 mx-4 rounded-full transition-all duration-500 ${step > num ? 'bg-green-500' : 'bg-gray-200'}`} />
          )}
        </Fragment>
      ))}
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
          Create New RTI Request
        </h1>
        <p className="text-gray-600 mt-2 text-lg">
          Generate an official Right to Information request in three simple steps.
        </p>
      </div>

      {renderStepIndicator()}

      <div className="mt-4">
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-1 bg-blue-900 rounded-full" />
              <h2 className="text-xl font-bold text-gray-900">
                Step 1: Select a Template
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {mockTemplates.map((template) => (
                <div
                  key={template.id}
                  className="group bg-white border border-gray-200 rounded-2xl p-6 flex flex-col hover:border-blue-900 hover:shadow-xl transition-all duration-300 cursor-pointer"
                  onClick={() => handleTemplateSelect(template.id, template.content || '', template.title)}
                >
                  <div className="bg-blue-50 w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-900 group-hover:text-white transition-colors">
                    <FileText className="w-6 h-6 text-blue-900 group-hover:text-white" />
                  </div>
                  <h3 className="font-bold text-gray-900 text-lg mb-2">
                    {template.title}
                  </h3>
                  <p className="text-sm text-gray-600 line-clamp-3 mb-6 flex-1">
                    {template.description}
                  </p>
                  <Button
                    variant="outline"
                    fullWidth
                    className="group-hover:bg-blue-900 group-hover:text-white group-hover:border-blue-900"
                  >
                    Use Template
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="bg-white border border-gray-200 rounded-3xl p-8 shadow-sm space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="flex items-center gap-2">
              <div className="h-8 w-1 bg-blue-900 rounded-full" />
              <h2 className="text-xl font-bold text-gray-900">
                Step 2: Data Entry
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <Input
                  label="Request Title"
                  placeholder="e.g., Annual Budget Report 2023"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />

                <div className="flex flex-col space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <textarea
                    className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:border-blue-900 min-h-[120px] transition-all"
                    placeholder="Brief description of the request purpose..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <Input
                  label="Request Date"
                  type="date"
                  value={formData.requestDate}
                  onChange={(e) => setFormData({ ...formData, requestDate: e.target.value })}
                />
              </div>

              <div className="space-y-6 bg-gray-50 p-6 rounded-2xl border border-dashed border-gray-300">
                <div className="flex items-center gap-2 mb-2 text-blue-900 font-semibold uppercase tracking-wider text-xs">
                  <User className="w-4 h-4" /> Entity Selection
                </div>

                <Select
                  label="Sender (Applicant)"
                  options={mockSenders.map((s) => ({
                    value: s.id,
                    label: s.name
                  }))}
                  value={formData.senderId}
                  onChange={(e) => setFormData({ ...formData, senderId: e.target.value })}
                />

                <Select
                  label="Receiver (Institution)"
                  options={mockReceivers.map((r) => ({
                    value: r.id,
                    label: `${r.institutionName} - ${r.positionName}`
                  }))}
                  value={formData.receiverId}
                  onChange={(e) => setFormData({ ...formData, receiverId: e.target.value })}
                />

                <div className="mt-6 pt-6 border-t border-gray-200">
                  <p className="text-xs text-gray-500 italic">
                    The selected sender and receiver information will be automatically injected into the document template.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-6 border-t border-gray-100">
              <Button variant="secondary" onClick={() => setStep(1)} className="flex items-center gap-2">
                <ChevronLeft className="w-4 h-4" /> Back to Templates
              </Button>
              <Button
                onClick={() => {
                  setStep(3);
                }}
                disabled={!formData.title || !formData.senderId || !formData.receiverId}
                className="flex items-center gap-2 bg-blue-900 hover:bg-blue-800"
              >
                Continue to Finalize <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-1 bg-blue-900 rounded-full" />
                <h2 className="text-xl font-bold text-gray-900">
                  Step 3: Document Finalization
                </h2>
              </div>
              <div className="text-xs px-3 py-1 bg-orange-100 text-orange-700 rounded-full font-bold uppercase tracking-wide">
                Final Tweak Mode
              </div>
            </div>

            <div className="h-[650px]">
              <div className="flex flex-col bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden border-t-4 border-t-blue-900 h-full">
                <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 text-sm font-bold text-gray-700 flex items-center justify-between">
                  <span>Smart Editor</span>
                  <span className="text-[10px] text-gray-400 font-normal">Rich editor with variables</span>
                </div>
                <SmartEditor
                  ref={editorRef}
                  initialMarkdown={formData.content}
                  placeholders={placeholders}
                  className="flex-1"
                  onChange={(markdown) => setFormData(prev => ({ ...prev, content: markdown }))}
                />
              </div>
            </div>

            <div className="flex justify-between items-center pt-4">
              <Button variant="secondary" onClick={() => setStep(2)} className="flex items-center gap-2">
                <ChevronLeft className="w-4 h-4" /> Back to Details
              </Button>
              <div className="flex gap-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    const finalMarkdown = editorRef.current?.getMarkdown();
                    console.log('Saving draft:', finalMarkdown);
                    navigate('/');
                  }}
                  className="flex items-center gap-2"
                >
                  <Save className="w-4 h-4" /> Save Draft
                </Button>
                <Button
                  onClick={() => {
                    const finalMarkdown = editorRef.current?.getMarkdown();
                    console.log('Dispatching request:', finalMarkdown);
                    navigate('/');
                  }}
                  className="flex items-center gap-2 bg-blue-900 shadow-lg"
                >
                  <Send className="w-4 h-4" /> Dispatch Request
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
