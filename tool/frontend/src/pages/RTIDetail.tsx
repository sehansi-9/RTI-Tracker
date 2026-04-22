import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, FileText, CheckCircle, Upload, Clock, User, Building2, Mail } from 'lucide-react';
import { rtiRequestsService } from '../services/rtiRequestsService';
import { RTIRequest, RTIStatusHistory } from '../types/db';
import { Button } from '../components/Button';
import toast from 'react-hot-toast';

export function RTIDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [request, setRequest] = useState<RTIRequest | null>(null);
  const [history, setHistory] = useState<RTIStatusHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAllData = async () => {
      if (!id) return;
      setIsLoading(true);
      try {
        const [reqData, historyData] = await Promise.all([
          rtiRequestsService.details(id),
          rtiRequestsService.getHistory(id)
        ]);
        setRequest(reqData);
        setHistory(historyData);
      } catch (e) {
        toast.error('Failed to load RTI details');
        navigate('/rti-requests');
      } finally {
        setIsLoading(false);
      }
    };
    fetchAllData();
  }, [id, navigate]);

  if (isLoading || !request) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-900"></div>
        <p className="text-gray-500 font-medium">Loading RTI details...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Navigation & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <button
          onClick={() => navigate('/rti-requests')}
          className="flex items-center text-sm font-medium text-gray-500 hover:text-blue-900 transition-colors group"
        >
          <ChevronLeft className="w-4 h-4 mr-1 transition-transform group-hover:-translate-x-1" />
          Back to RTI Requests
        </button>

        <div className="flex gap-3">

          <Button variant="primary" className="flex items-center gap-2 bg-blue-900">
            <CheckCircle className="w-4 h-4" /> Mark as Completed
          </Button>
        </div>
      </div>

      {/* Header Banner */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{request?.title}</h1>
              <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider border border-blue-100">
                In Progress
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-y-2 gap-x-6 text-sm text-gray-500">
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                Last Updated: {new Date(request.updatedAt).toLocaleDateString()}
              </div>
              <div className="flex items-center gap-1.5 font-mono text-xs">
                Ref: {request?.referenceId || request?.id.split('-')[1]?.toUpperCase() || 'N/A'}
              </div>
            </div>
          </div>

        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Left Columns: Core Info */}
        <div className="space-y-6">

          {/* Overview */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4 space-y-6">
            <div>
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-900" />
                Request Description
              </h2>
              <p className="text-gray-600 leading-relaxed text-xs">
                {request?.description || 'No description provided.'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-3 border-t border-gray-50">
              {/* Sender Info */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Sender Details</h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <User className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-gray-900">{request?.senderName}</p>
                      <p className="text-xs text-gray-500">Applicant</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <p className="text-xs text-gray-600">{request?.senderEmail || 'No email'}</p>
                  </div>
                </div>
              </div>

              {/* Receiver Info */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Target Entity</h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Building2 className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-gray-900">{request?.institutionName}</p>
                      <p className="text-xs text-gray-500">{request?.positionName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <p className="text-xs text-gray-600">{request?.receiverEmail || 'No email'}</p>
                  </div>
                </div>
              </div>

              {/* Template Info */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Template Information</h3>
                <div className="flex items-start gap-3">
                  <FileText className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-gray-900">{request?.rtiTemplateTitle || 'Custom Request'}</p>
                    {request?.rtiTemplateFile && (
                      <p className="text-[10px] text-gray-400 font-mono break-all mt-1">{request?.rtiTemplateFile}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-900" />
                Life-Cycle Timeline
              </h2>
              <Button size="sm" variant="outline" className="text-xs">Add Event</Button>
            </div>
            <div className="p-6">
              {history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400 space-y-2">
                  <Clock className="w-8 h-8 opacity-20" />
                  <p className="text-sm">No events logged yet.</p>
                </div>
              ) : (
                <div className="space-y-8">
                  {history.map((h, idx) => (
                    <div key={h.id} className="relative pl-8 group">
                      {/* Line */}
                      {idx !== history.length - 1 && (
                        <div className="absolute left-[11px] top-6 bottom-[-32px] w-[2px] bg-gray-100 group-hover:bg-blue-100 transition-colors" />
                      )}

                      {/* Dot */}
                      <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-white border-2 border-blue-900 flex items-center justify-center z-10 shadow-sm">
                        <div className="w-2 h-2 rounded-full bg-blue-900" />
                      </div>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h4 className="text-sm font-bold text-gray-900">{h.statusId}</h4>
                          <span className="text-[10px] font-medium text-gray-400">{new Date(h.entryTime).toLocaleString()}</span>
                        </div>
                        <p className="text-sm text-gray-600">{h.description || 'No additional details provided.'}</p>
                        <div className="flex items-center gap-4 pt-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider ${h.direction === 'outgoing' ? 'bg-orange-50 text-orange-700' : 'bg-green-50 text-green-700'}`}>
                            {h.direction}
                          </span>
                          {h.file && (
                            <button
                              onClick={() => {
                                const link = document.createElement('a');
                                link.href = h.file!;
                                link.download = h.file!.split('/').pop() || 'document.pdf';
                                link.click();
                              }}
                              className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors border border-blue-100"
                            >
                              <FileText className="w-3 h-3" />
                              <span className="text-[10px] font-bold uppercase tracking-wider">Download PDF</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
