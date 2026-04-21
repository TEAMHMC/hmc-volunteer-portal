import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, CheckCircle, Clock, Users, FileText, Activity, Download, RefreshCw, ChevronDown, Upload, X, Eye } from 'lucide-react';

interface User {
  id: string;
  name: string;
  role: string;
  isAdmin?: boolean;
  token?: string;
}

interface ReportSummary {
  totalClients: number;
  totalScreenings: number;
  abnormalScreenings: number;
  totalReferrals: number;
  pendingReferrals: number;
  urgentReferrals: number;
  overdueReferrals: number;
  slaCompliance: number | null;
}

interface ActionItem {
  clientId: string;
  clientName: string;
  pendingReferrals: number;
  urgentReferrals: number;
  flagged: boolean;
  abnormalScreening: boolean;
}

interface EventOption {
  id: string;
  title: string;
  date: string;
  location: string;
}

interface ReportData {
  generatedAt: string;
  dateRange: { from: string; to: string };
  eventId: string | null;
  summary: ReportSummary;
  demographics: {
    housing: Record<string, number>;
    insurance: Record<string, number>;
    language: Record<string, number>;
    needs: Record<string, number>;
  };
  actionItems: ActionItem[];
  events: EventOption[];
}

interface ClientDoc {
  id: string;
  fileName: string;
  fileType: string;
  documentType: string;
  notes: string;
  uploadedBy: string;
  createdAt: string;
}

const DOCUMENT_TYPES = ['Consent Form', 'Intake Form', 'Screening Form', 'Referral Form', 'Insurance Card', 'ID / Photo ID', 'Clinical Notes', 'General'];

function StatCard({ label, value, sub, color, icon: Icon }: { label: string; value: string | number; sub?: string; color: string; icon: React.ElementType }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-5">
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-black uppercase tracking-[0.15em] text-zinc-400">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
          <Icon size={15} />
        </div>
      </div>
      <div className="text-3xl font-black text-zinc-900">{value}</div>
      {sub && <div className="text-xs text-zinc-400 font-medium mt-1">{sub}</div>}
    </div>
  );
}

function DemographicBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-36 text-zinc-600 font-medium truncate">{label}</span>
      <div className="flex-1 bg-zinc-100 rounded-full h-2">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-12 text-right font-bold text-zinc-700">{count} <span className="font-normal text-zinc-400">({pct}%)</span></span>
    </div>
  );
}

function UploadDocumentModal({ clientId, clientName, token, onClose, onUploaded }: {
  clientId: string; clientName: string; token: string; onClose: () => void; onUploaded: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState('General');
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = (e.target?.result as string)?.split(',')[1];
        const res = await fetch(`/api/clients/${clientId}/documents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ fileName: file.name, fileType: file.type, fileData: base64, documentType: docType, notes }),
        });
        if (!res.ok) throw new Error('Upload failed');
        onUploaded();
        onClose();
      };
      reader.readAsDataURL(file);
    } catch {
      setError('Upload failed. Please try again.');
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-black text-lg">Upload Document</h3>
            <p className="text-sm text-zinc-500">{clientName}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-xl"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-zinc-500 mb-1.5">Document Type</label>
            <select value={docType} onChange={e => setDocType(e.target.value)} className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm font-medium">
              {DOCUMENT_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-zinc-500 mb-1.5">File (PDF, JPG, PNG)</label>
            <div className="border-2 border-dashed border-zinc-200 rounded-xl p-6 text-center cursor-pointer hover:border-zinc-300 transition-colors" onClick={() => document.getElementById('doc-file-input')?.click()}>
              {file ? (
                <div className="text-sm font-medium text-zinc-700">{file.name}<br /><span className="text-zinc-400 text-xs">{(file.size / 1024).toFixed(0)} KB</span></div>
              ) : (
                <>
                  <Upload size={20} className="mx-auto text-zinc-300 mb-2" />
                  <p className="text-sm text-zinc-400">Click to select file</p>
                  <p className="text-xs text-zinc-300 mt-1">PDF, JPG, PNG up to 10MB</p>
                </>
              )}
            </div>
            <input id="doc-file-input" type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-zinc-500 mb-1.5">Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Any notes about this document…" className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm resize-none" />
          </div>

          {error && <p className="text-sm text-red-500 font-medium">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-zinc-200 rounded-xl text-sm font-bold hover:bg-zinc-50">Cancel</button>
            <button onClick={handleUpload} disabled={!file || uploading} className="flex-1 px-4 py-2.5 bg-zinc-900 text-white rounded-xl text-sm font-bold disabled:opacity-40 hover:bg-zinc-800">
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PostOutreachReport({ user }: { user: User }) {
  const token = (user as any).token || '';
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedEventId, setSelectedEventId] = useState('');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [uploadModal, setUploadModal] = useState<{ clientId: string; clientName: string } | null>(null);
  const [clientDocs, setClientDocs] = useState<Record<string, ClientDoc[]>>({});
  const [expandedClient, setExpandedClient] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (selectedEventId) params.set('eventId', selectedEventId);
      else { params.set('dateFrom', dateFrom); params.set('dateTo', dateTo); }
      const res = await fetch(`/api/outreach-report?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Failed to load report');
      setReport(await res.json());
    } catch {
      setError('Failed to load report. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [selectedEventId, dateFrom, dateTo, token]);

  useEffect(() => { fetchReport(); }, []);

  const fetchClientDocs = async (clientId: string) => {
    if (clientDocs[clientId]) return;
    try {
      const res = await fetch(`/api/clients/${clientId}/documents`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const docs = await res.json();
        setClientDocs(prev => ({ ...prev, [clientId]: docs }));
      }
    } catch {}
  };

  const handleExpandClient = (clientId: string) => {
    if (expandedClient === clientId) { setExpandedClient(null); return; }
    setExpandedClient(clientId);
    fetchClientDocs(clientId);
  };

  const printReport = () => window.print();

  const topNeeds = report ? Object.entries(report.demographics.needs).sort((a, b) => b[1] - a[1]).slice(0, 8) : [];
  const topHousing = report ? Object.entries(report.demographics.housing).sort((a, b) => b[1] - a[1]) : [];
  const topInsurance = report ? Object.entries(report.demographics.insurance).sort((a, b) => b[1] - a[1]) : [];
  const totalClients = report?.summary.totalClients || 0;

  return (
    <div className="space-y-6 pb-20 print:pb-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl md:text-5xl font-black tracking-tighter uppercase italic">Post-Outreach Report</h2>
          <p className="text-zinc-500 mt-2 font-medium text-sm md:text-base">Clients seen, referrals needed, and clinical action items.</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <button onClick={printReport} className="flex items-center gap-2 px-4 py-2 border border-zinc-200 rounded-full text-sm font-bold hover:bg-zinc-50">
            <Download size={14} /> Export / Print
          </button>
          <button onClick={fetchReport} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white rounded-full text-sm font-bold hover:bg-zinc-800 disabled:opacity-50">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-4 print:hidden">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-zinc-400 mb-1">Filter by Event</label>
            <div className="relative">
              <select
                value={selectedEventId}
                onChange={e => setSelectedEventId(e.target.value)}
                className="appearance-none border border-zinc-200 rounded-xl px-3 py-2 pr-8 text-sm font-medium min-w-[200px]"
              >
                <option value="">All Events (Date Range)</option>
                {report?.events.map(e => (
                  <option key={e.id} value={e.id}>{e.title} — {e.date ? new Date(e.date).toLocaleDateString() : 'TBD'}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            </div>
          </div>
          {!selectedEventId && (
            <>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-zinc-400 mb-1">From</label>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="border border-zinc-200 rounded-xl px-3 py-2 text-sm font-medium" />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-zinc-400 mb-1">To</label>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="border border-zinc-200 rounded-xl px-3 py-2 text-sm font-medium" />
              </div>
            </>
          )}
          <button onClick={fetchReport} disabled={loading} className="px-4 py-2 bg-zinc-900 text-white rounded-xl text-sm font-bold hover:bg-zinc-800 disabled:opacity-50">
            {loading ? 'Loading…' : 'Run Report'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700 font-medium">{error}</div>
      )}

      {report && (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Clients Seen" value={report.summary.totalClients} sub="This period" color="bg-blue-100 text-blue-600" icon={Users} />
            <StatCard label="Screenings Done" value={report.summary.totalScreenings} sub={`${report.summary.abnormalScreenings} abnormal`} color="bg-emerald-100 text-emerald-600" icon={Activity} />
            <StatCard label="Referrals Made" value={report.summary.totalReferrals} sub={`${report.summary.pendingReferrals} pending`} color="bg-orange-100 text-orange-600" icon={FileText} />
            <StatCard
              label="SLA Compliance"
              value={report.summary.slaCompliance !== null ? `${report.summary.slaCompliance}%` : 'N/A'}
              sub="72-hr standard"
              color={report.summary.slaCompliance !== null && report.summary.slaCompliance >= 80 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}
              icon={Clock}
            />
          </div>

          {/* Urgent alerts */}
          {(report.summary.urgentReferrals > 0 || report.summary.overdueReferrals > 0 || report.summary.abnormalScreenings > 0) && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-5 space-y-2">
              <div className="flex items-center gap-2 text-red-700 font-black text-sm uppercase tracking-wider mb-3">
                <AlertTriangle size={16} /> Needs Immediate Attention
              </div>
              {report.summary.urgentReferrals > 0 && (
                <div className="flex items-center gap-2 text-sm text-red-700 font-medium">
                  <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                  {report.summary.urgentReferrals} urgent or emergency referral{report.summary.urgentReferrals !== 1 ? 's' : ''} require immediate follow-up
                </div>
              )}
              {report.summary.overdueReferrals > 0 && (
                <div className="flex items-center gap-2 text-sm text-red-700 font-medium">
                  <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                  {report.summary.overdueReferrals} referral{report.summary.overdueReferrals !== 1 ? 's' : ''} past 72-hour SLA window
                </div>
              )}
              {report.summary.abnormalScreenings > 0 && (
                <div className="flex items-center gap-2 text-sm text-red-700 font-medium">
                  <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                  {report.summary.abnormalScreenings} client{report.summary.abnormalScreenings !== 1 ? 's' : ''} with abnormal vitals needing clinical review
                </div>
              )}
            </div>
          )}

          {/* Action items per client */}
          {report.actionItems.length > 0 && (
            <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-zinc-100">
                <h3 className="font-black text-base uppercase tracking-tight">Clinical Action Items</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Clients requiring referral, follow-up, or clinical review</p>
              </div>
              <div className="divide-y divide-zinc-100">
                {report.actionItems.map(item => (
                  <div key={item.clientId}>
                    <div className="flex items-center gap-3 p-4 hover:bg-zinc-50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm text-zinc-900">{item.clientName}</div>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {item.urgentReferrals > 0 && (
                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-100 text-red-700">URGENT</span>
                          )}
                          {item.pendingReferrals > 0 && (
                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">{item.pendingReferrals} Referral{item.pendingReferrals !== 1 ? 's' : ''} Pending</span>
                          )}
                          {item.abnormalScreening && (
                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Abnormal Vitals</span>
                          )}
                          {item.flagged && (
                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">Flagged</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 print:hidden">
                        <button
                          onClick={() => setUploadModal({ clientId: item.clientId, clientName: item.clientName })}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-zinc-200 rounded-full hover:bg-zinc-50"
                        >
                          <Upload size={12} /> Upload Form
                        </button>
                        <button
                          onClick={() => handleExpandClient(item.clientId)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-zinc-200 rounded-full hover:bg-zinc-50"
                        >
                          <Eye size={12} /> {expandedClient === item.clientId ? 'Hide' : 'Docs'}
                        </button>
                      </div>
                    </div>

                    {/* Client docs expansion */}
                    {expandedClient === item.clientId && (
                      <div className="px-4 pb-4 bg-zinc-50 border-t border-zinc-100">
                        <div className="pt-3 space-y-2">
                          {(clientDocs[item.clientId] || []).length === 0 ? (
                            <p className="text-xs text-zinc-400 font-medium">No documents uploaded yet.</p>
                          ) : (
                            clientDocs[item.clientId].map(doc => (
                              <div key={doc.id} className="flex items-center gap-3 bg-white rounded-xl px-3 py-2.5 border border-zinc-200 text-sm">
                                <FileText size={14} className="text-zinc-400 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-zinc-800 truncate">{doc.fileName}</div>
                                  <div className="text-xs text-zinc-400">{doc.documentType} · {doc.uploadedBy} · {new Date(doc.createdAt).toLocaleDateString()}</div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {report.actionItems.length === 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-center gap-3">
              <CheckCircle size={20} className="text-emerald-600 flex-shrink-0" />
              <div>
                <div className="font-black text-sm text-emerald-800">All clear — no immediate action items</div>
                <div className="text-xs text-emerald-600 mt-0.5">No pending referrals, abnormal screenings, or flags for this period</div>
              </div>
            </div>
          )}

          {/* Demographics */}
          {totalClients > 0 && (
            <div className="grid md:grid-cols-2 gap-4">
              {/* Top needs */}
              {topNeeds.length > 0 && (
                <div className="bg-white border border-zinc-200 rounded-2xl p-5">
                  <h3 className="font-black text-sm uppercase tracking-tight mb-4">Top Presenting Needs</h3>
                  <div className="space-y-3">
                    {topNeeds.map(([need, count]) => (
                      <DemographicBar key={need} label={need} count={count} total={totalClients} color="bg-blue-400" />
                    ))}
                  </div>
                </div>
              )}

              {/* Housing + Insurance */}
              <div className="space-y-4">
                {topHousing.length > 0 && (
                  <div className="bg-white border border-zinc-200 rounded-2xl p-5">
                    <h3 className="font-black text-sm uppercase tracking-tight mb-4">Housing Status</h3>
                    <div className="space-y-3">
                      {topHousing.map(([status, count]) => (
                        <DemographicBar key={status} label={status} count={count} total={totalClients} color="bg-orange-400" />
                      ))}
                    </div>
                  </div>
                )}
                {topInsurance.length > 0 && (
                  <div className="bg-white border border-zinc-200 rounded-2xl p-5">
                    <h3 className="font-black text-sm uppercase tracking-tight mb-4">Insurance Status</h3>
                    <div className="space-y-3">
                      {topInsurance.map(([status, count]) => (
                        <DemographicBar key={status} label={status} count={count} total={totalClients} color="bg-emerald-400" />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {totalClients === 0 && !loading && (
            <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-10 text-center">
              <Users size={32} className="mx-auto text-zinc-300 mb-3" />
              <p className="font-bold text-zinc-500">No clients found for this period</p>
              <p className="text-sm text-zinc-400 mt-1">Try expanding the date range or selecting a different event</p>
            </div>
          )}

          <div className="text-xs text-zinc-400 text-right">
            Report generated {new Date(report.generatedAt).toLocaleString()}
          </div>
        </>
      )}

      {loading && !report && (
        <div className="flex items-center justify-center py-20">
          <RefreshCw size={24} className="animate-spin text-zinc-400" />
        </div>
      )}

      {/* Upload modal */}
      {uploadModal && (
        <UploadDocumentModal
          clientId={uploadModal.clientId}
          clientName={uploadModal.clientName}
          token={token}
          onClose={() => setUploadModal(null)}
          onUploaded={() => {
            fetchClientDocs(uploadModal.clientId);
            setClientDocs(prev => ({ ...prev, [uploadModal.clientId]: [] }));
          }}
        />
      )}
    </div>
  );
}
