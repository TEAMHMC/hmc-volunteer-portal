
import React, { useState, useRef } from 'react';
import { Volunteer, Task, ComplianceStep } from '../types';
import { APP_CONFIG } from '../config';
import { apiService } from '../services/apiService';
import { 
  Search, MoreVertical, ShieldCheck, 
  X, Award, Mail, Phone, FileCheck, Fingerprint, Star,
  Filter, UserPlus, ChevronRight, ClipboardList, CheckCircle, Tag, Loader2, MessageSquare, Send, Check, UploadCloud
} from 'lucide-react';

interface DirectoryProps {
  volunteers: Volunteer[];
  setVolunteers: React.Dispatch<React.SetStateAction<Volunteer[]>>;
  onAssignTask?: (volunteerId: string, task: { title: string; description: string; dueDate?: string }) => void;
  currentUser: Volunteer;
}

const fileToBase64 = (file: File): Promise<string> => new Promise((res, rej) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => res((reader.result as string).split(',')[1]);
  reader.onerror = error => rej(error);
});

const AdminVolunteerDirectory: React.FC<DirectoryProps> = ({ volunteers, setVolunteers, currentUser, onAssignTask }) => {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [selectedVolunteer, setSelectedVolunteer] = useState<Volunteer | null>(null);
  const [editingTags, setEditingTags] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [viewMode, setViewMode] = useState<'all' | 'applicants'>('all');
  const [isReviewing, setIsReviewing] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  
  const applicantsCount = volunteers.filter(v => v.applicationStatus === 'pendingReview').length;

  const filtered = volunteers.filter(v => {
    if (viewMode === 'applicants') {
      if (v.applicationStatus !== 'pendingReview') return false;
    } else {
      if (v.applicationStatus === 'pendingReview') return false;
    }
    const searchLower = search.toLowerCase();
    const matchesText = v.name.toLowerCase().includes(searchLower) || v.email.toLowerCase().includes(searchLower);
    const matchesRole = roleFilter === 'All' || v.role === roleFilter;
    return matchesText && matchesRole;
  });

  const roles = ["All", ...APP_CONFIG.HMC_ROLES.map(r => r.label)];

  const getComplianceStatus = (status?: string) => {
    return status === 'verified' || status === 'completed'
      ? { color: 'text-emerald-500', bg: 'bg-emerald-50/60', border: 'border-emerald-100/50' }
      : { color: 'text-zinc-300', bg: 'bg-zinc-50', border: 'border-zinc-100' };
  };

  const handleUpdateVolunteer = async (updatedVolunteer: Volunteer) => {
      try {
        await apiService.post('/api/admin/update-volunteer-profile', { volunteer: updatedVolunteer });
        setVolunteers(prev => prev.map(v => v.id === updatedVolunteer.id ? updatedVolunteer : v));
        setSelectedVolunteer(updatedVolunteer); // Keep modal updated
      } catch (error) {
        alert(`Failed to update volunteer: ${(error as Error).message}`);
      }
  };
  
  const handleAddTag = () => {
    if (tagInput && selectedVolunteer && !selectedVolunteer.tags?.includes(tagInput)) {
        const updatedVolunteer = { ...selectedVolunteer, tags: [...(selectedVolunteer.tags || []), tagInput] };
        handleUpdateVolunteer(updatedVolunteer);
        setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    if (selectedVolunteer) {
        const updatedVolunteer = { ...selectedVolunteer, tags: selectedVolunteer.tags?.filter(t => t !== tagToRemove) };
        handleUpdateVolunteer(updatedVolunteer);
    }
  };
  
  const handleReview = async (action: 'approve' | 'reject', notes: string) => {
    if (!selectedVolunteer) return;
    setIsReviewing(true);
    try {
        const { volunteer: updatedVolunteer } = await apiService.post('/api/admin/review-application', { volunteerId: selectedVolunteer.id, action, notes });
        setVolunteers(prev => prev.map(v => v.id === updatedVolunteer.id ? updatedVolunteer : v));
        setSelectedVolunteer(null); // Close modal on success
    } catch (error) {
        alert(`Failed to review application: ${(error as Error).message}`);
    } finally {
        setIsReviewing(false);
    }
  };

  return (
    <>
      <div className="space-y-12 animate-in fade-in duration-500 pb-32">
        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-10">
          <div className="max-w-xl">
            <h2 className="text-5xl font-black text-zinc-900 tracking-tighter">Volunteer Directory</h2>
            <p className="text-zinc-500 mt-4 font-medium text-lg leading-relaxed">
              Authorized personnel management for <span className="text-zinc-900 font-black">{volunteers.filter(v => v.applicationStatus !== 'pendingReview').length}</span> verified community contributors.
            </p>
          </div>
          
          <div className="flex flex-col md:flex-row items-center gap-4">
            <button onClick={() => setShowImportModal(true)} className="py-5 px-6 bg-white border border-zinc-100 rounded-full text-zinc-400 font-black text-[11px] uppercase tracking-widest flex items-center gap-3"><UploadCloud size={16}/>Bulk Import</button>
            <div className="relative group w-full md:w-auto">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-300 group-focus-within:text-[#233DFF] transition-colors" size={18} />
              <input 
                type="text" 
                placeholder="Search..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-16 pr-8 py-5 bg-white border border-zinc-100 rounded-[32px] text-sm w-full md:w-64 outline-none shadow-sm focus:border-zinc-300 transition-all font-bold placeholder:text-zinc-200" 
              />
            </div>
          </div>
        </div>
        
        <div className="flex bg-white border border-zinc-100 p-1.5 rounded-full shadow-sm w-fit">
            <button onClick={() => setViewMode('all')} className={`px-6 py-3 rounded-full text-[11px] font-black uppercase tracking-widest ${viewMode === 'all' ? 'bg-[#233DFF] text-white shadow-lg' : 'text-zinc-400'}`}>Directory</button>
            <button onClick={() => setViewMode('applicants')} className={`px-6 py-3 rounded-full text-[11px] font-black uppercase tracking-widest relative ${viewMode === 'applicants' ? 'bg-[#233DFF] text-white shadow-lg' : 'text-zinc-400'}`}>
              Applicants {applicantsCount > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] rounded-full flex items-center justify-center">{applicantsCount}</span>}
            </button>
        </div>


        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {filtered.map(v => (
            <div 
              key={v.id} 
              onClick={() => setSelectedVolunteer(v)}
              className="bg-white p-10 rounded-[56px] border border-zinc-100 shadow-[0_4px_24px_rgba(0,0,0,0.02)] hover:shadow-2xl hover:-translate-y-2 transition-all cursor-pointer group flex flex-col justify-between relative overflow-hidden"
            >
               <div className="flex justify-between items-start mb-8 relative z-10">
                  <div className="flex items-center gap-5">
                     <div className="w-16 h-16 rounded-[24px] bg-zinc-900 text-white flex items-center justify-center font-black text-xl shadow-xl overflow-hidden border border-black/10">
                        {v.avatarUrl ? <img src={v.avatarUrl} className="w-full h-full object-cover" /> : v.name.charAt(0)}
                     </div>
                     <div>
                        <h3 className="text-lg font-black text-zinc-900 leading-tight group-hover:text-[#233DFF] transition-colors">{v.name}</h3>
                        <p className="text-[10px] font-black text-zinc-300 uppercase tracking-[0.15em] mt-1">{v.applicationStatus === 'pendingReview' ? `Applied for: ${v.appliedRole}` : v.role}</p>
                     </div>
                  </div>
                  <button className="p-3 bg-zinc-50 rounded-full text-zinc-200 hover:text-zinc-900 transition-colors"><MoreVertical size={20} /></button>
               </div>

               <div className="bg-zinc-50/50 p-6 rounded-[32px] border border-zinc-100/50 mb-8 relative z-10">
                  <p className="text-[9px] font-black text-zinc-300 uppercase tracking-widest mb-4">Compliance Status</p>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { icon: ShieldCheck, status: v.compliance.backgroundCheck.status, label: 'Safety' },
                      { icon: Fingerprint, status: v.compliance.liveScan?.status, label: 'Bio' },
                      { icon: FileCheck, status: v.compliance.training.status, label: 'Unit' },
                    ].map((item, i) => {
                      const style = getComplianceStatus(item.status);
                      return (
                        <div key={i} className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all ${style.bg} ${style.border} ${style.color}`}>
                           <item.icon size={20} strokeWidth={2.5} />
                           <span className="text-[8px] font-black uppercase tracking-widest">{item.label}</span>
                        </div>
                      )
                    })}
                  </div>
               </div>

               <div className="space-y-4 relative z-10">
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-zinc-300 px-1">
                     <span>Onboarding Progress</span>
                     <span className="text-zinc-900">{v.onboardingProgress}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-zinc-50 rounded-full overflow-hidden border border-zinc-100 shadow-inner">
                     <div className="h-full bg-[#233DFF] transition-all duration-1000 shadow-[0_0_10px_#233DFF33]" style={{ width: `${v.onboardingProgress}%` }} />
                  </div>
               </div>

               <div className="mt-10 pt-8 border-t border-zinc-50 flex items-center justify-between relative z-10">
                  <div>
                     <p className="text-[9px] font-black text-zinc-300 uppercase tracking-widest mb-1">Hours Contributed</p>
                     <p className="text-2xl font-black text-zinc-900 tracking-tighter leading-none">{Math.floor(v.hoursContributed)} <span className="text-xs font-bold text-zinc-300">HRS</span></p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-zinc-50 border border-zinc-100 flex items-center justify-center text-zinc-200 group-hover:bg-[#233DFF] group-hover:text-white transition-all group-hover:scale-110 shadow-sm">
                     <ChevronRight size={24} />
                  </div>
               </div>
               <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#233DFF]/5 rounded-full blur-3xl pointer-events-none group-hover:bg-[#233DFF]/10 transition-all" />
            </div>
          ))}
          
          <button className="bg-white border-2 border-dashed border-zinc-100 rounded-[56px] p-12 flex flex-col items-center justify-center text-zinc-300 gap-6 hover:bg-zinc-50/50 hover:border-[#233DFF]/20 hover:text-[#233DFF] transition-all group">
             <div className="w-20 h-20 rounded-full bg-zinc-50 flex items-center justify-center group-hover:bg-white group-hover:shadow-xl transition-all">
                <UserPlus size={32} strokeWidth={1.5} />
             </div>
             <div className="text-center">
               <p className="text-[11px] font-black uppercase tracking-[0.2em]">Add Volunteer</p>
               <p className="text-[10px] font-medium text-zinc-400 mt-2">Add a new volunteer manually</p>
             </div>
          </button>
        </div>
      </div>
      
      {selectedVolunteer && (
        <div className="fixed inset-0 bg-zinc-900/80 backdrop-blur-md z-[1000] flex items-center justify-center p-8 animate-in fade-in" onClick={() => setSelectedVolunteer(null)}>
           <div className="bg-white max-w-4xl w-full rounded-[56px] shadow-2xl border border-zinc-100 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
              <header className="p-10 border-b border-zinc-100 flex items-center justify-between shrink-0">
                 <div className="flex items-center gap-6">
                    <div className="w-20 h-20 rounded-[28px] bg-zinc-900 text-white flex items-center justify-center font-black text-2xl shadow-xl overflow-hidden">
                       {selectedVolunteer.avatarUrl ? <img src={selectedVolunteer.avatarUrl} className="w-full h-full object-cover" /> : selectedVolunteer.name.charAt(0)}
                    </div>
                    <div>
                       <h2 className="text-3xl font-black text-zinc-900 tracking-tight">{selectedVolunteer.name}</h2>
                       <p className="text-zinc-400 font-bold uppercase tracking-widest text-xs mt-1">{selectedVolunteer.applicationStatus === 'pendingReview' ? `Applied for: ${selectedVolunteer.appliedRole}` : selectedVolunteer.role}</p>
                    </div>
                 </div>
                 <button onClick={() => setSelectedVolunteer(null)} className="p-4 bg-zinc-50 rounded-full text-zinc-400 hover:text-zinc-900 transition-colors"><X size={24} /></button>
              </header>
              <main className="p-10 grid grid-cols-1 md:grid-cols-2 gap-10 overflow-y-auto">
                 <div className="space-y-8">
                    <div className="space-y-2">
                       <h4 className="text-xs font-black text-zinc-400 uppercase tracking-widest">Contact Info</h4>
                       <div className="p-6 bg-zinc-50 rounded-2xl border border-zinc-100 space-y-3">
                          <p className="flex items-center gap-3 font-bold text-sm text-zinc-700"><Mail size={16} className="text-zinc-300"/> {selectedVolunteer.email}</p>
                          <p className="flex items-center gap-3 font-bold text-sm text-zinc-700"><Phone size={16} className="text-zinc-300"/> {selectedVolunteer.phone}</p>
                       </div>
                    </div>
                    
                    <RoleManagementPanel currentUser={currentUser} selectedVolunteer={selectedVolunteer} onUpdate={handleUpdateVolunteer} />

                    <div className="space-y-2">
                       <div className="flex justify-between items-center">
                         <h4 className="text-xs font-black text-zinc-400 uppercase tracking-widest">Tags</h4>
                         <button onClick={() => setEditingTags(!editingTags)} className="text-xs font-bold">{editingTags ? 'Done' : 'Edit Tags'}</button>
                       </div>
                       <div className="p-6 bg-zinc-50 rounded-2xl border border-zinc-100">
                          <div className="flex flex-wrap gap-2">
                            {selectedVolunteer.tags?.map(t => (
                              <span key={t} className="flex items-center gap-1 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold">
                                {t}
                                {editingTags && <button onClick={() => handleRemoveTag(t)}><X size={12} /></button>}
                              </span>
                            ))}
                            {!selectedVolunteer.tags?.length && !editingTags && <p className="text-xs text-zinc-400 italic">No tags assigned.</p>}
                          </div>
                          {editingTags && (
                             <div className="flex gap-2 mt-4">
                                <input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddTag()} placeholder="Add new tag..." className="flex-1 bg-white border rounded-lg px-2 py-1 text-xs"/>
                                <button onClick={handleAddTag} className="px-3 py-1 bg-zinc-800 text-white rounded-lg text-xs font-bold">Add</button>
                             </div>
                          )}
                       </div>
                    </div>
                     <div className="space-y-2">
                       <h4 className="text-xs font-black text-zinc-400 uppercase tracking-widest">Achievements</h4>
                       <div className="space-y-2">
                          {selectedVolunteer.achievements.map(a => (
                            <div key={a.id} className="flex items-center gap-3 p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                               <Award size={16} className="text-amber-400"/>
                               <p className="font-bold text-xs text-zinc-700">{a.title}</p>
                            </div>
                          ))}
                       </div>
                    </div>
                 </div>
                 <div className="bg-zinc-50/70 p-8 rounded-[32px] border border-zinc-100 space-y-6">
                    <h4 className="text-xs font-black text-zinc-400 uppercase tracking-widest">Compliance Checklist</h4>
                    {Object.values(selectedVolunteer.compliance).map((c: ComplianceStep) => (
                      <div key={c.id} className="flex items-center gap-4">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${c.status === 'verified' || c.status === 'completed' ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-white text-zinc-300 border-zinc-200'}`}><CheckCircle size={16}/></div>
                        <p className={`font-bold text-sm ${c.status === 'verified' || c.status === 'completed' ? 'text-zinc-800' : 'text-zinc-400'}`}>{c.label}</p>
                      </div>
                    ))}
                 </div>
                 {selectedVolunteer.applicationStatus === 'pendingReview' && <ApplicationReviewPanel volunteer={selectedVolunteer} onReview={handleReview} isReviewing={isReviewing} />}
              </main>
           </div>
        </div>
      )}
      
      {showImportModal && <BulkImportModal onClose={() => setShowImportModal(false)} setVolunteers={setVolunteers} />}
    </>
  );
};

const RoleManagementPanel: React.FC<{currentUser: Volunteer, selectedVolunteer: Volunteer, onUpdate: (v: Volunteer) => void}> = ({currentUser, selectedVolunteer, onUpdate}) => {
    const [isEditingRole, setIsEditingRole] = useState(false);
    const [newRole, setNewRole] = useState(selectedVolunteer.role);

    const handleSaveRole = () => {
        onUpdate({ ...selectedVolunteer, role: newRole });
        setIsEditingRole(false);
    }
    
    const handlePromote = () => {
        const updatedTags = [...(selectedVolunteer.tags || []).filter(t => t !== 'Shift Lead'), 'Shift Lead'];
        onUpdate({ ...selectedVolunteer, tags: updatedTags });
    }

    if (!currentUser.isAdmin && currentUser.role !== 'Volunteer Lead') return null;

    return (
        <div className="space-y-2">
            <h4 className="text-xs font-black text-zinc-400 uppercase tracking-widest">Role Management</h4>
            <div className="p-6 bg-zinc-50 rounded-2xl border border-zinc-100">
                {currentUser.isAdmin ? (
                    isEditingRole ? (
                        <div className="space-y-4">
                            <select value={newRole} onChange={e => setNewRole(e.target.value)} className="w-full p-3 bg-white border border-zinc-200 rounded-lg font-bold">
                                {APP_CONFIG.HMC_ROLES.map(r => <option key={r.id} value={r.label}>{r.label}</option>)}
                            </select>
                            <div className="flex gap-2">
                                <button onClick={() => setIsEditingRole(false)} className="flex-1 text-xs font-bold py-2 border rounded-lg">Cancel</button>
                                <button onClick={handleSaveRole} className="flex-1 text-xs font-bold py-2 bg-zinc-800 text-white rounded-lg">Save Role</button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between">
                            <p className="font-bold">{selectedVolunteer.role}</p>
                            <button onClick={() => setIsEditingRole(true)} className="text-xs font-bold">Edit Role</button>
                        </div>
                    )
                ) : currentUser.role === 'Volunteer Lead' ? (
                     <button onClick={handlePromote} className="w-full text-center py-3 bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold">
                        Promote to Shift Lead
                     </button>
                ) : null}
            </div>
        </div>
    )
};

const ApplicationReviewPanel: React.FC<{volunteer: Volunteer, onReview: (action: 'approve' | 'reject', notes: string) => void, isReviewing: boolean}> = ({ volunteer, onReview, isReviewing }) => {
    const [notes, setNotes] = useState('');
    return (
        <div className="md:col-span-2 bg-amber-50 p-6 rounded-[32px] border-2 border-amber-200 space-y-4 animate-in fade-in">
            <h3 className="text-sm font-black text-amber-800 uppercase tracking-widest">Application Review for: {volunteer.appliedRole}</h3>
            {volunteer.roleAssessment && volunteer.roleAssessment.length > 0 && (
                <div className="space-y-3">
                    {volunteer.roleAssessment.map((qa, i) => (
                        <div key={i} className="bg-white/60 p-4 rounded-xl">
                            <p className="text-xs font-bold text-zinc-500">{qa.question}</p>
                            <p className="text-sm text-zinc-700 italic mt-1">"{qa.answer}"</p>
                        </div>
                    ))}
                </div>
            )}
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add review notes (optional)..." className="w-full h-24 p-4 text-sm bg-white border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-400" />
            <div className="flex items-center gap-4">
                <button onClick={() => onReview('approve', notes)} disabled={isReviewing} className="flex-1 py-4 bg-emerald-600 text-white rounded-full font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-700 disabled:opacity-50">
                    {isReviewing ? <Loader2 size={16} className="animate-spin" /> : <><Check size={16}/> Approve for Role</>}
                </button>
                <button onClick={() => onReview('reject', notes)} disabled={isReviewing} className="flex-1 py-4 bg-indigo-600 text-white rounded-full font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-700 disabled:opacity-50">
                    {isReviewing ? <Loader2 size={16} className="animate-spin" /> : <><Award size={16}/> Keep as Champion</>}
                </button>
            </div>
        </div>
    );
}

const BulkImportModal: React.FC<{onClose: () => void, setVolunteers: Function}> = ({ onClose, setVolunteers }) => {
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState('');
    const [successCount, setSuccessCount] = useState<number | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFile(e.target.files ? e.target.files[0] : null);
        setError('');
        setSuccessCount(null);
    }

    const handleUpload = async () => {
        if (!file) {
            setError('Please select a CSV file to upload.');
            return;
        }
        setIsUploading(true);
        setError('');
        setSuccessCount(null);
        try {
            const base64Data = await fileToBase64(file);
            const result = await apiService.post('/api/admin/bulk-import', { csvData: base64Data });
            setSuccessCount(result.importedCount);
            setVolunteers((prev: Volunteer[]) => [...prev, ...result.newVolunteers]);
        } catch(e) {
            setError((e as Error).message);
        } finally {
            setIsUploading(false);
        }
    }

    return (
        <div className="fixed inset-0 bg-zinc-900/80 backdrop-blur-md z-[1000] flex items-center justify-center p-8 animate-in fade-in" onClick={onClose}>
            <div className="bg-white max-w-2xl w-full rounded-[56px] shadow-2xl border border-zinc-100 p-12 space-y-8" onClick={e => e.stopPropagation()}>
                <h2 className="text-3xl font-black text-zinc-900 tracking-tight">Bulk Import Volunteers</h2>
                <p className="text-zinc-500">Upload a CSV file to migrate existing volunteers. The system will create their accounts and send them a welcome email to set their password and complete their profile.</p>
                
                <div className="p-6 bg-zinc-50 border border-zinc-100 rounded-2xl text-xs text-zinc-500">
                    <p className="font-bold mb-2">Required CSV Format:</p>
                    <code className="font-mono">email,legalFirstName,legalLastName,role,joinedDate,hoursContributed</code>
                </div>

                {successCount !== null ? (
                    <div className="p-8 bg-emerald-50 border border-emerald-200 rounded-2xl text-center">
                        <CheckCircle className="mx-auto text-emerald-500 mb-4" size={48} />
                        <h3 className="font-black text-emerald-800">Import Successful</h3>
                        <p className="text-emerald-700">{successCount} volunteers have been imported and sent a welcome email.</p>
                        <button onClick={onClose} className="mt-4 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg">Done</button>
                    </div>
                ) : (
                    <>
                        <input type="file" accept=".csv" onChange={handleFileChange} className="w-full text-sm text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
                        {error && <p className="text-rose-500 text-sm text-center font-bold">{error}</p>}
                        <button onClick={handleUpload} disabled={isUploading || !file} className="w-full py-5 bg-[#233DFF] text-white rounded-full font-black text-sm uppercase tracking-widest flex items-center justify-center gap-4 disabled:opacity-50">
                            {isUploading ? <Loader2 className="animate-spin"/> : "Start Import"}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

export default AdminVolunteerDirectory;
