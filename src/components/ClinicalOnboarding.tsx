
import React, { useState, useRef, useEffect } from 'react';
import { Volunteer } from '../types';
import { apiService } from '../services/apiService';
import { toastService } from '../services/toastService';
import {
  FileText, CheckCircle, Lock, Upload, Pen, ChevronRight, ChevronDown,
  AlertTriangle, Loader2, X, Award, Shield, ClipboardCheck, Stethoscope, Download
} from 'lucide-react';

interface ClinicalOnboardingProps {
  user: Volunteer;
  onUpdate: (user: Volunteer) => void;
}

interface DocumentItem {
  id: string;
  title: string;
  description: string;
  type: 'pdf' | 'html';
  url: string;
  required: boolean;
}

const CLINICAL_DOCUMENTS: DocumentItem[] = [
  {
    id: 'clinicalOnboardingGuide',
    title: 'Clinical Onboarding & Governance Guide',
    description: 'Complete guide to HMC clinical protocols, governance structure, and volunteer expectations',
    type: 'html',
    url: '/documents/clinical-onboarding-guide.html',
    required: true
  },
  {
    id: 'policiesProcedures',
    title: 'Clinical Policies & Procedures Manual',
    description: 'Comprehensive policies and procedures for all clinical operations',
    type: 'html',
    url: '/documents/HMC-Clinical-Policies-Procedures-Manual-v1.0.html',
    required: true
  },
  {
    id: 'screeningConsent',
    title: 'General Screening Consent Form',
    description: 'Consent form template used for client health screenings',
    type: 'html',
    url: '/documents/HMC-General-Screening-Consent-Form.html',
    required: true
  },
  {
    id: 'standingOrders',
    title: 'Standing Orders v3.0',
    description: 'Current standing orders for clinical procedures and protocols',
    type: 'html',
    url: '/documents/HMC-Standing-Orders-v3.0.html',
    required: true
  }
];

const ClinicalOnboarding: React.FC<ClinicalOnboardingProps> = ({ user, onUpdate }) => {
  const [activeSection, setActiveSection] = useState<'documents' | 'credentials'>('documents');
  const [activeDocument, setActiveDocument] = useState<DocumentItem | null>(null);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [credentials, setCredentials] = useState(user.clinicalOnboarding?.credentials || {});
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  const clinicalOnboarding = user.clinicalOnboarding || {
    completed: false,
    documents: {},
    credentials: {}
  };

  const signedDocuments = Object.entries(clinicalOnboarding.documents || {})
    .filter(([_, doc]) => doc?.signed)
    .map(([id]) => id);

  const allDocumentsSigned = CLINICAL_DOCUMENTS.every(doc =>
    signedDocuments.includes(doc.id)
  );

  const hasRequiredCredentials = !!(
    credentials.npi &&
    credentials.licenseNumber &&
    credentials.licenseState &&
    credentials.licenseExpiration
  );

  const isComplete = allDocumentsSigned && hasRequiredCredentials;

  const handleSignDocument = async (documentId: string, signatureData: string) => {
    setIsSaving(true);
    try {
      const updatedDocuments = {
        ...clinicalOnboarding.documents,
        [documentId]: {
          signed: true,
          signedAt: new Date().toISOString(),
          signatureData
        }
      };

      const updatedOnboarding = {
        ...clinicalOnboarding,
        documents: updatedDocuments,
        completed: false // Will be set to true when all complete
      };

      const updatedUser = {
        ...user,
        clinicalOnboarding: updatedOnboarding
      };

      await apiService.put('/api/volunteer', updatedUser);
      onUpdate(updatedUser);
      setActiveDocument(null);
      setShowSignatureModal(false);
    } catch (error) {
      console.error('Failed to save signature:', error);
      toastService.error('Failed to save signature. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveCredentials = async () => {
    setIsSaving(true);
    try {
      const allDocsSigned = CLINICAL_DOCUMENTS.every(doc =>
        clinicalOnboarding.documents?.[doc.id as keyof typeof clinicalOnboarding.documents]?.signed
      );

      const hasReqCreds = !!(
        credentials.npi &&
        credentials.licenseNumber &&
        credentials.licenseState &&
        credentials.licenseExpiration
      );

      const updatedOnboarding = {
        ...clinicalOnboarding,
        credentials,
        completed: allDocsSigned && hasReqCreds,
        completedAt: allDocsSigned && hasReqCreds ? new Date().toISOString() : undefined
      };

      const updatedUser = {
        ...user,
        clinicalOnboarding: updatedOnboarding
      };

      await apiService.put('/api/volunteer', updatedUser);
      onUpdate(updatedUser);
    } catch (error) {
      console.error('Failed to save credentials:', error);
      toastService.error('Failed to save credentials. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = async (field: string, file: File) => {
    setUploadingField(field);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(',')[1];
        try {
          const result = await apiService.post('/api/volunteer/credential-file', {
            field,
            base64,
            contentType: file.type,
            fileName: file.name,
          });
          setCredentials(prev => ({ ...prev, [field]: result.storagePath }));
        } catch (uploadErr) {
          console.error('Cloud upload failed, storing locally:', uploadErr);
          setCredentials(prev => ({ ...prev, [field]: dataUrl }));
        }
        setUploadingField(null);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Failed to upload file:', error);
      toastService.error('Failed to upload file. Please try again.');
      setUploadingField(null);
    }
  };

  const handleViewCredentialFile = async (field: string) => {
    try {
      const result = await apiService.get(`/api/volunteer/${user.id}/credential-file/${field}`);
      if (result.url) window.open(result.url, '_blank');
    } catch {
      toastService.error('Unable to open file. It may not be stored in cloud storage.');
    }
  };

  const completedCount = signedDocuments.length;
  const totalRequired = CLINICAL_DOCUMENTS.length;
  const progressPercent = Math.round((completedCount / totalRequired) * 100);

  return (
    <div className="space-y-8 animate-in fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-5xl font-black tracking-tighter uppercase italic flex items-center gap-3">
            <Stethoscope className="text-brand" />
            Clinical Onboarding
          </h2>
          <p className="text-lg font-medium text-zinc-500 mt-2">Complete all required documents and credentials to begin clinical work</p>
        </div>
        {isComplete && (
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 rounded-full font-bold">
            <CheckCircle size={20} />
            Onboarding Complete
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="bg-white rounded-[40px] p-8 border border-zinc-100 shadow-sm hover:shadow-2xl transition-shadow">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-bold text-zinc-400">Overall Progress</span>
          <span className="text-sm font-black text-brand">{progressPercent}%</span>
        </div>
        <div className="h-3 bg-zinc-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-brand to-brand-hover rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between mt-3 text-xs text-zinc-400">
          <span>{completedCount} of {totalRequired} documents signed</span>
          <span>{hasRequiredCredentials ? 'Credentials complete' : 'Credentials pending'}</span>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveSection('documents')}
          className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all ${
            activeSection === 'documents'
              ? 'bg-brand text-white shadow-elevation-2'
              : 'bg-white text-zinc-600 border border-zinc-200 hover:border-brand/40'
          }`}
        >
          <FileText size={18} />
          Documents ({completedCount}/{totalRequired})
        </button>
        <button
          onClick={() => setActiveSection('credentials')}
          className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all ${
            activeSection === 'credentials'
              ? 'bg-brand text-white shadow-elevation-2'
              : 'bg-white text-zinc-600 border border-zinc-200 hover:border-brand/40'
          }`}
        >
          <Award size={18} />
          Credentials {hasRequiredCredentials && <CheckCircle size={14} className="text-emerald-400" />}
        </button>
      </div>

      {/* Documents Section */}
      {activeSection === 'documents' && (
        <div className="space-y-4">
          {CLINICAL_DOCUMENTS.map((doc) => {
            const isSigned = signedDocuments.includes(doc.id);
            return (
              <div
                key={doc.id}
                className={`bg-white rounded-[40px] p-8 border shadow-sm hover:shadow-2xl transition-shadow ${
                  isSigned ? 'border-emerald-200 bg-emerald-50/30' : 'border-zinc-100 hover:border-brand/20'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-3xl ${isSigned ? 'bg-emerald-100 text-emerald-600' : 'bg-zinc-100 text-zinc-400'}`}>
                      {isSigned ? <CheckCircle size={24} /> : <FileText size={24} />}
                    </div>
                    <div>
                      <h3 className="font-bold text-zinc-900">{doc.title}</h3>
                      <p className="text-sm text-zinc-500 mt-1">{doc.description}</p>
                      {isSigned && (
                        <div className="flex items-center gap-3 mt-2">
                          <p className="text-xs text-emerald-600 font-bold">
                            Signed on {new Date(clinicalOnboarding.documents?.[doc.id as keyof typeof clinicalOnboarding.documents]?.signedAt || '').toLocaleDateString()}
                          </p>
                          <button
                            onClick={(e) => { e.stopPropagation(); window.open(`/api/clinical/forms/${doc.id}/pdf`, '_blank'); }}
                            className="flex items-center gap-1 text-xs text-brand font-bold hover:underline"
                          >
                            <Download size={12} /> PDF
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveDocument(doc)}
                    className={`px-4 py-2 rounded-full font-bold text-sm uppercase tracking-wide transition-all flex items-center gap-2 ${
                      isSigned
                        ? 'bg-white border border-black text-zinc-600 hover:bg-zinc-200'
                        : 'bg-brand border border-black text-white hover:bg-brand-hover shadow-elevation-2'
                    }`}
                  >
                    {isSigned ? 'View' : 'Review & Sign'}
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Credentials Section */}
      {activeSection === 'credentials' && (
        <div className="bg-white rounded-[40px] p-8 border border-zinc-100 shadow-sm hover:shadow-2xl transition-shadow space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-zinc-100">
            <Shield className="text-brand" size={24} />
            <div>
              <h3 className="font-bold text-zinc-900">Professional Credentials</h3>
              <p className="text-sm text-zinc-500">Enter your license information and upload documentation</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* NPI Number */}
            <div>
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">
                NPI Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={credentials.npi || ''}
                onChange={(e) => setCredentials({ ...credentials, npi: e.target.value })}
                placeholder="1234567890"
                maxLength={10}
                className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm"
              />
            </div>

            {/* License Number */}
            <div>
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">
                License Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={credentials.licenseNumber || ''}
                onChange={(e) => setCredentials({ ...credentials, licenseNumber: e.target.value })}
                placeholder="MD12345"
                className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm"
              />
            </div>

            {/* License State */}
            <div>
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">
                License State <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={credentials.licenseState || ''}
                onChange={(e) => setCredentials({ ...credentials, licenseState: e.target.value.toUpperCase() })}
                placeholder="CA"
                maxLength={2}
                className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm"
              />
            </div>

            {/* License Expiration */}
            <div>
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">
                License Expiration <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={credentials.licenseExpiration || ''}
                onChange={(e) => setCredentials({ ...credentials, licenseExpiration: e.target.value })}
                className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm"
              />
            </div>

            {/* License Upload */}
            <div className="md:col-span-2">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">
                Upload License Copy
              </label>
              <div className="flex items-center gap-4">
                <label className="flex-1 flex items-center justify-center gap-3 px-4 py-4 bg-zinc-50 border-2 border-dashed border-zinc-100 rounded-2xl cursor-pointer hover:border-brand/40 hover:bg-brand/5 transition-all">
                  <Upload size={20} className="text-zinc-400" />
                  <span className="text-sm font-bold text-zinc-600">
                    {credentials.licenseFileUrl ? 'License uploaded' : 'Click to upload'}
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFileUpload('licenseFileUrl', e.target.files[0])}
                  />
                </label>
                {credentials.licenseFileUrl && (
                  <>
                    <CheckCircle className="text-emerald-500" size={24} />
                    {typeof credentials.licenseFileUrl === 'string' && credentials.licenseFileUrl.startsWith('credentials/') && (
                      <button onClick={() => handleViewCredentialFile('licenseFileUrl')} className="text-xs text-brand font-bold hover:underline">View</button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* DEA Number (Optional) */}
            <div>
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">
                DEA Number (if applicable)
              </label>
              <input
                type="text"
                value={credentials.deaNumber || ''}
                onChange={(e) => setCredentials({ ...credentials, deaNumber: e.target.value })}
                placeholder="AB1234567"
                className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm"
              />
            </div>

            {/* DEA Expiration */}
            <div>
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">
                DEA Expiration
              </label>
              <input
                type="date"
                value={credentials.deaExpiration || ''}
                onChange={(e) => setCredentials({ ...credentials, deaExpiration: e.target.value })}
                className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm"
              />
            </div>

            {/* Board Certification */}
            <div>
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">
                Board Certification
              </label>
              <input
                type="text"
                value={credentials.boardCertification || ''}
                onChange={(e) => setCredentials({ ...credentials, boardCertification: e.target.value })}
                placeholder="e.g., ABFM, ABIM"
                className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm"
              />
            </div>

            {/* Board Cert Expiration */}
            <div>
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">
                Board Cert Expiration
              </label>
              <input
                type="date"
                value={credentials.boardCertExpiration || ''}
                onChange={(e) => setCredentials({ ...credentials, boardCertExpiration: e.target.value })}
                className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm"
              />
            </div>

            {/* Malpractice Insurance */}
            <div className="md:col-span-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={credentials.malpracticeInsurance || false}
                  onChange={(e) => setCredentials({ ...credentials, malpracticeInsurance: e.target.checked })}
                  className="w-5 h-5 rounded border-zinc-300"
                />
                <span className="text-sm font-bold text-zinc-600">
                  I have current malpractice insurance coverage
                </span>
              </label>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-zinc-100">
            <button
              onClick={handleSaveCredentials}
              disabled={isSaving}
              className="px-6 py-3 bg-brand border border-black text-white font-bold rounded-full uppercase tracking-wide hover:bg-brand-hover disabled:opacity-50 flex items-center gap-2 shadow-elevation-2"
            >
              {isSaving ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />}
              Save Credentials
            </button>
          </div>
        </div>
      )}

      {/* Document Viewer Modal */}
      {activeDocument && (
        <DocumentViewerModal
          document={activeDocument}
          isSigned={signedDocuments.includes(activeDocument.id)}
          onClose={() => setActiveDocument(null)}
          onSign={(signatureData) => handleSignDocument(activeDocument.id, signatureData)}
          isSaving={isSaving}
        />
      )}
    </div>
  );
};

// Document Viewer Modal with Signature Pad
const DocumentViewerModal: React.FC<{
  document: DocumentItem;
  isSigned: boolean;
  onClose: () => void;
  onSign: (signatureData: string) => void;
  isSaving: boolean;
}> = ({ document, isSigned, onClose, onSign, isSaving }) => {
  const [showSignature, setShowSignature] = useState(false);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(isSigned);
  const contentRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [iframeHeight, setIframeHeight] = useState(600);

  // Auto-size iframe to its content so scrolling happens in the outer container
  const handleIframeLoad = () => {
    try {
      const iframe = iframeRef.current;
      if (iframe?.contentDocument?.body) {
        const height = iframe.contentDocument.body.scrollHeight + 40;
        setIframeHeight(Math.max(600, height));
      } else {
        // Can't access iframe content (cross-origin) — auto-unlock after a read-through delay
        setTimeout(() => setHasScrolledToBottom(true), 8000);
      }
    } catch {
      // Cross-origin fallback: auto-unlock after delay so users aren't permanently blocked
      setTimeout(() => setHasScrolledToBottom(true), 8000);
    }
  };

  const handleScroll = () => {
    if (contentRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
      if (scrollTop + clientHeight >= scrollHeight - 50) {
        setHasScrolledToBottom(true);
      }
    }
  };

  // Also listen to iframe internal scroll as a fallback (for when iframe can't be auto-sized)
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const onIframeScroll = () => {
      try {
        const doc = iframe.contentDocument;
        if (doc) {
          const scrollTop = doc.documentElement.scrollTop || doc.body.scrollTop;
          const scrollHeight = doc.documentElement.scrollHeight || doc.body.scrollHeight;
          const clientHeight = doc.documentElement.clientHeight || doc.body.clientHeight;
          if (scrollTop + clientHeight >= scrollHeight - 50) {
            setHasScrolledToBottom(true);
          }
        }
      } catch { /* cross-origin — handled by timeout fallback */ }
    };
    const attachListener = () => {
      try {
        iframe.contentDocument?.addEventListener('scroll', onIframeScroll);
      } catch { /* cross-origin */ }
    };
    iframe.addEventListener('load', attachListener);
    attachListener(); // try immediately in case already loaded
    return () => {
      iframe.removeEventListener('load', attachListener);
      try { iframe.contentDocument?.removeEventListener('scroll', onIframeScroll); } catch {}
    };
  }, [showSignature]); // re-attach when toggling between doc view and signature

  // Canvas drawing functions
  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (!canvasRef.current) return;
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.strokeStyle = '#1e3a8a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const submitSignature = () => {
    if (!canvasRef.current || !hasSignature) return;
    const signatureData = canvasRef.current.toDataURL();
    onSign(signatureData);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-modal shadow-elevation-3 border border-zinc-100 flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-100">
          <div>
            <h3 className="text-xl font-bold text-zinc-900">{document.title}</h3>
            <p className="text-sm text-zinc-500">{isSigned ? 'Document signed' : 'Review and sign this document'}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full">
            <X size={24} className="text-zinc-400" />
          </button>
        </div>

        {/* Content */}
        {!showSignature ? (
          <>
            <div
              ref={contentRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto p-6 bg-zinc-50 min-h-0"
            >
              <iframe
                ref={iframeRef}
                src={document.url}
                onLoad={handleIframeLoad}
                style={{ height: `${iframeHeight}px` }}
                className="w-full bg-white rounded-3xl shadow-elevation-1 border-0"
                title={document.title}
              />
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-zinc-100 bg-white">
              {isSigned ? (
                <div className="flex items-center justify-center gap-2 text-emerald-600 font-bold">
                  <CheckCircle size={20} />
                  Document Already Signed
                </div>
              ) : !hasScrolledToBottom ? (
                <div className="flex items-center justify-center gap-2 text-amber-600">
                  <AlertTriangle size={18} />
                  <span className="text-sm font-bold">Please scroll through the entire document to enable signing</span>
                </div>
              ) : (
                <button
                  onClick={() => setShowSignature(true)}
                  className="w-full py-4 bg-brand border border-black text-white font-bold rounded-full uppercase tracking-wide hover:bg-brand-hover flex items-center justify-center gap-2 shadow-elevation-2"
                >
                  <Pen size={18} />
                  Proceed to Sign Document
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Signature Pad */}
            <div className="flex-1 p-6 flex flex-col items-center justify-center bg-zinc-50">
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-4">Draw Your Signature Below</p>
              <div className="bg-white rounded-3xl border-2 border-zinc-100 p-2 shadow-inner">
                <canvas
                  ref={canvasRef}
                  width={500}
                  height={200}
                  className="border border-zinc-100 rounded-2xl cursor-crosshair touch-none"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
              </div>
              <button
                onClick={clearSignature}
                className="mt-3 text-sm text-zinc-500 hover:text-zinc-700 font-bold"
              >
                Clear Signature
              </button>
            </div>

            {/* Signature Footer */}
            <div className="p-6 border-t border-zinc-100 bg-white flex gap-4">
              <button
                onClick={() => setShowSignature(false)}
                className="flex-1 py-3 bg-white border border-black text-zinc-900 font-bold rounded-full uppercase tracking-wide hover:bg-zinc-200"
              >
                Back to Document
              </button>
              <button
                onClick={submitSignature}
                disabled={!hasSignature || isSaving}
                className="flex-1 py-3 bg-brand border border-black text-white font-bold rounded-full uppercase tracking-wide hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSaving ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                Submit Signature
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ClinicalOnboarding;
