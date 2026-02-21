
import React, { useState, useRef, useEffect } from 'react';
import { Volunteer, Task, ComplianceStep } from '../types';
import { APP_CONFIG } from '../config';
import { apiService } from '../services/apiService';
import {
  Search, MoreVertical, ShieldCheck,
  X, Award, Mail, Phone, FileCheck, Fingerprint, Star,
  Filter, UserPlus, ChevronRight, ChevronDown, ClipboardList, CheckCircle, Tag, Loader2, MessageSquare, Send, Check, UploadCloud, Trash2, Download, ClipboardCheck, User, MapPin, AlertCircle, Clock, Briefcase, FileText, Calendar, Globe, Pencil, Save
} from 'lucide-react';
import { GOVERNANCE_ROLES } from '../constants';
import { toastService } from '../services/toastService';

const downloadPdf = async (url: string) => {
  const token = localStorage.getItem('authToken');
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('Download failed');
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  window.open(blobUrl, '_blank');
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
};

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
  const [groupFilter, setGroupFilter] = useState<'all' | 'group' | 'individual' | 'returning'>('all');
  const [selectedVolunteer, setSelectedVolunteer] = useState<Volunteer | null>(null);
  const [editingTags, setEditingTags] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [viewMode, setViewMode] = useState<'all' | 'applicants'>('all');
  const [isReviewing, setIsReviewing] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAddVolunteerModal, setShowAddVolunteerModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [isAssigningTask, setIsAssigningTask] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCompliance, setShowCompliance] = useState(false);
  const [complianceData, setComplianceData] = useState<any[]>([]);
  const [complianceLoading, setComplianceLoading] = useState(false);
  const [showFullApplication, setShowFullApplication] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editProfileData, setEditProfileData] = useState<Record<string, any>>({});
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const applicantsCount = volunteers.filter(v => v.applicationStatus === 'pendingReview').length;

  const filtered = volunteers.filter(v => {
    if (viewMode === 'applicants') {
      if (v.applicationStatus !== 'pendingReview') return false;
    } else {
      if (v.applicationStatus === 'pendingReview') return false;
    }
    const searchLower = search.toLowerCase();
    const matchesText = v.name.toLowerCase().includes(searchLower) || v.email.toLowerCase().includes(searchLower) || v.groupName?.toLowerCase().includes(searchLower);
    const matchesRole = roleFilter === 'All' || v.role === roleFilter;
    const matchesGroupFilter = groupFilter === 'all'
      || (groupFilter === 'group' && v.isGroupVolunteer)
      || (groupFilter === 'individual' && !v.isGroupVolunteer)
      || (groupFilter === 'returning' && v.isReturningVolunteer);
    return matchesText && matchesRole && matchesGroupFilter;
  });

  const groupVolunteersCount = volunteers.filter(v => v.isGroupVolunteer).length;
  const returningVolunteersCount = volunteers.filter(v => v.isReturningVolunteer).length;

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
        toastService.error(`Failed to update volunteer: ${(error as Error).message}`);
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

  const handleStartEditProfile = () => {
    if (!selectedVolunteer) return;
    setEditProfileData({
      legalFirstName: selectedVolunteer.legalFirstName || '',
      legalLastName: selectedVolunteer.legalLastName || '',
      preferredFirstName: selectedVolunteer.preferredFirstName || '',
      preferredLastName: selectedVolunteer.preferredLastName || '',
      phone: selectedVolunteer.phone || '',
      address: selectedVolunteer.address || '',
      city: selectedVolunteer.city || '',
      state: selectedVolunteer.state || '',
      zipCode: selectedVolunteer.zipCode || '',
      dob: selectedVolunteer.dob || '',
      gender: selectedVolunteer.gender || '',
      tshirtSize: selectedVolunteer.tshirtSize || '',
      eContactName: selectedVolunteer.emergencyContact?.name || '',
      eContactRelationship: selectedVolunteer.emergencyContact?.relationship || '',
      eContactCellPhone: selectedVolunteer.emergencyContact?.cellPhone || '',
      eContactEmail: selectedVolunteer.emergencyContact?.email || '',
      isGroupVolunteer: selectedVolunteer.isGroupVolunteer || false,
      groupType: selectedVolunteer.groupType || '',
      groupName: selectedVolunteer.groupName || '',
      groupSize: selectedVolunteer.groupSize || '',
      groupContactEmail: selectedVolunteer.groupContactEmail || '',
      appliedRole: selectedVolunteer.appliedRole || '',
      isTeamLead: selectedVolunteer.isTeamLead || false,
    });
    setIsEditingProfile(true);
  };

  const handleSaveProfile = async () => {
    if (!selectedVolunteer) return;
    setIsSavingProfile(true);
    try {
      const name = `${editProfileData.preferredFirstName || editProfileData.legalFirstName} ${editProfileData.preferredLastName || editProfileData.legalLastName}`.trim();
      const updatedVolunteer: Volunteer = {
        ...selectedVolunteer,
        legalFirstName: editProfileData.legalFirstName,
        legalLastName: editProfileData.legalLastName,
        preferredFirstName: editProfileData.preferredFirstName,
        preferredLastName: editProfileData.preferredLastName,
        name: name || selectedVolunteer.name,
        phone: editProfileData.phone,
        address: editProfileData.address,
        city: editProfileData.city,
        state: editProfileData.state,
        zipCode: editProfileData.zipCode,
        dob: editProfileData.dob,
        gender: editProfileData.gender,
        tshirtSize: editProfileData.tshirtSize,
        emergencyContact: {
          name: editProfileData.eContactName,
          relationship: editProfileData.eContactRelationship,
          cellPhone: editProfileData.eContactCellPhone,
          email: editProfileData.eContactEmail,
        },
        isGroupVolunteer: editProfileData.isGroupVolunteer,
        groupType: editProfileData.groupType,
        groupName: editProfileData.groupName,
        groupSize: editProfileData.groupSize ? Number(editProfileData.groupSize) : undefined,
        groupContactEmail: editProfileData.groupContactEmail,
        appliedRole: editProfileData.appliedRole,
        isTeamLead: editProfileData.isTeamLead,
      };
      await handleUpdateVolunteer(updatedVolunteer);
      setIsEditingProfile(false);
      toastService.success('Profile updated successfully.');
    } catch {
      toastService.error('Failed to update profile.');
    } finally {
      setIsSavingProfile(false);
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
        toastService.error(`Failed to review application: ${(error as Error).message}`);
    } finally {
        setIsReviewing(false);
    }
  };

  const handleAssignTask = async () => {
    if (!selectedVolunteer || !taskTitle.trim()) return;
    setIsAssigningTask(true);
    try {
      const newTask: Task = {
        id: `task-${Date.now()}`,
        title: taskTitle,
        description: taskDescription,
        status: 'pending',
        assignedDate: new Date().toISOString(),
        dueDate: taskDueDate || undefined
      };

      const updatedVolunteer = {
        ...selectedVolunteer,
        tasks: [...(selectedVolunteer.tasks || []), newTask]
      };

      await apiService.post('/api/admin/update-volunteer-profile', { volunteer: updatedVolunteer });
      setVolunteers(prev => prev.map(v => v.id === updatedVolunteer.id ? updatedVolunteer : v));
      setSelectedVolunteer(updatedVolunteer);

      // Reset form and close modal
      setTaskTitle('');
      setTaskDescription('');
      setTaskDueDate('');
      setShowTaskModal(false);

      if (onAssignTask) {
        onAssignTask(selectedVolunteer.id, { title: taskTitle, description: taskDescription, dueDate: taskDueDate });
      }
    } catch (error) {
      toastService.error(`Failed to assign task: ${(error as Error).message}`);
    } finally {
      setIsAssigningTask(false);
    }
  };

  const loadComplianceData = async () => {
    setComplianceLoading(true);
    try {
      const data = await apiService.get('/api/admin/compliance-overview');
      setComplianceData(data);
    } catch (err) {
      console.error('Failed to load compliance data:', err);
    } finally {
      setComplianceLoading(false);
    }
  };

  const handleToggleCompliance = () => {
    if (!showCompliance && complianceData.length === 0) loadComplianceData();
    setShowCompliance(!showCompliance);
  };

  const handleDownloadResume = async (volunteerId: string) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/admin/volunteer/${volunteerId}/resume`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition') || '';
      const fileName = disposition.match(/filename="(.+)"/)?.[1] || 'resume.pdf';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = fileName; a.click();
      URL.revokeObjectURL(url);
    } catch {
      toastService.error('No resume on file or download failed.');
    }
  };

  const handleViewCredentialFile = async (volunteerId: string, field: string) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/volunteer/${volunteerId}/credential-file/${field}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch {
      toastService.error('Unable to open credential file.');
    }
  };

  const handleDeleteVolunteer = async () => {
    if (!selectedVolunteer) return;
    setIsDeleting(true);
    try {
      await apiService.delete(`/api/admin/volunteer/${selectedVolunteer.id}`);
      setVolunteers(prev => prev.filter(v => v.id !== selectedVolunteer.id));
      setSelectedVolunteer(null);
      setShowDeleteConfirm(false);
    } catch (error) {
      toastService.error(`Failed to delete volunteer: ${(error as Error).message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="space-y-4 md:space-y-8 animate-in fade-in duration-500 pb-20">
        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 md:gap-10">
          <div className="max-w-xl">
            <h2 className="text-3xl md:text-5xl font-black tracking-tighter uppercase italic">Volunteer Directory</h2>
            <p className="text-zinc-500 mt-4 font-medium text-sm md:text-lg leading-relaxed">
              Authorized personnel management for <span className="text-zinc-900 font-black">{volunteers.filter(v => v.applicationStatus !== 'pendingReview').length}</span> verified community contributors.
            </p>
          </div>
          
          <div className="flex flex-col md:flex-row items-center gap-4">
            <button onClick={() => setShowImportModal(true)} className="py-5 px-6 bg-white border border-black rounded-full text-zinc-400 font-bold text-[11px] uppercase tracking-wide flex items-center gap-3 shadow-elevation-1"><UploadCloud size={16}/>Bulk Import</button>
            <div className="relative group w-full md:w-auto">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-300 group-focus-within:text-brand transition-colors" size={18} />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-16 pr-8 py-5 bg-zinc-50 border-2 border-zinc-100 rounded-2xl text-sm w-full md:w-64 outline-none shadow-elevation-1 focus:border-brand/30 transition-all font-bold placeholder:text-zinc-200"
              />
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex bg-white border border-zinc-100 p-1.5 rounded-full shadow-elevation-1 w-fit">
              <button onClick={() => setViewMode('all')} className={`px-6 py-3 rounded-full text-[11px] font-bold uppercase tracking-wider ${viewMode === 'all' ? 'bg-brand text-white shadow-elevation-2' : 'text-zinc-400'}`}>Directory</button>
              <button onClick={() => setViewMode('applicants')} className={`px-6 py-3 rounded-full text-[11px] font-bold uppercase tracking-wider relative ${viewMode === 'applicants' ? 'bg-brand text-white shadow-elevation-2' : 'text-zinc-400'}`}>
                Applicants {applicantsCount > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] rounded-full flex items-center justify-center">{applicantsCount}</span>}
              </button>
          </div>

          <div className="flex bg-white border border-zinc-100 p-1.5 rounded-full shadow-elevation-1">
              <button onClick={() => setGroupFilter('all')} className={`px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-wider ${groupFilter === 'all' ? 'bg-brand text-white' : 'text-zinc-400'}`}>All</button>
              <button onClick={() => setGroupFilter('group')} className={`px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-wider relative ${groupFilter === 'group' ? 'bg-purple-600 text-white' : 'text-zinc-400'}`}>
                Groups {groupVolunteersCount > 0 && <span className="ml-1 text-purple-400">({groupVolunteersCount})</span>}
              </button>
              <button onClick={() => setGroupFilter('returning')} className={`px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-wider relative ${groupFilter === 'returning' ? 'bg-brand text-white' : 'text-zinc-400'}`}>
                Returning {returningVolunteersCount > 0 && <span className="ml-1 text-emerald-400">({returningVolunteersCount})</span>}
              </button>
              <button onClick={() => setGroupFilter('individual')} className={`px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-wider ${groupFilter === 'individual' ? 'bg-brand text-white' : 'text-zinc-400'}`}>Individual</button>
          </div>

          <button
            onClick={handleToggleCompliance}
            className={`px-5 py-3 rounded-full text-[11px] font-bold uppercase tracking-wider flex items-center gap-2 border transition-all ${
              showCompliance ? 'bg-brand text-white border-brand shadow-elevation-2' : 'bg-white text-zinc-400 border-zinc-100 hover:border-brand/40'
            }`}
          >
            <ClipboardCheck size={14} /> Compliance
          </button>
        </div>


        {showCompliance && (
          <div className="bg-white rounded-2xl md:rounded-[40px] border border-zinc-100 shadow-sm hover:shadow-2xl transition-shadow overflow-hidden">
            <div className="p-4 md:p-6 border-b border-zinc-100">
              <h3 className="text-base md:text-xl font-bold text-zinc-900 flex items-center gap-2"><ClipboardCheck size={20} className="text-brand" /> Compliance Overview</h3>
              <p className="text-sm text-zinc-600 mt-1">Form completion status across all volunteers</p>
            </div>
            {complianceLoading ? (
              <div className="p-4 md:p-8 flex justify-center"><Loader2 className="animate-spin text-zinc-300" size={28} /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs whitespace-nowrap">
                  <thead>
                    <tr className="bg-zinc-50 border-b border-zinc-100">
                      <th className="text-left px-4 py-3 font-bold text-zinc-500 uppercase tracking-wider sticky left-0 bg-zinc-50">Volunteer</th>
                      <th className="text-left px-3 py-3 font-bold text-zinc-500 uppercase tracking-wider">Role</th>
                      <th className="text-center px-2 py-3 font-bold text-zinc-400 uppercase tracking-wider">BG Check</th>
                      <th className="text-center px-2 py-3 font-bold text-zinc-400 uppercase tracking-wider">HIPAA</th>
                      <th className="text-center px-2 py-3 font-bold text-zinc-400 uppercase tracking-wider">Training</th>
                      <th className="text-center px-2 py-3 font-bold text-zinc-400 uppercase tracking-wider">COI</th>
                      <th className="text-center px-2 py-3 font-bold text-zinc-400 uppercase tracking-wider">Confid.</th>
                      <th className="text-center px-2 py-3 font-bold text-zinc-400 uppercase tracking-wider">Conduct</th>
                      <th className="text-center px-2 py-3 font-bold text-zinc-400 uppercase tracking-wider">Commit.</th>
                      <th className="text-center px-2 py-3 font-bold text-zinc-400 uppercase tracking-wider">Media</th>
                      <th className="text-center px-2 py-3 font-bold text-zinc-400 uppercase tracking-wider">Clin. Guide</th>
                      <th className="text-center px-2 py-3 font-bold text-zinc-400 uppercase tracking-wider">Policies</th>
                      <th className="text-center px-2 py-3 font-bold text-zinc-400 uppercase tracking-wider">Consent</th>
                      <th className="text-center px-2 py-3 font-bold text-zinc-400 uppercase tracking-wider">Orders</th>
                    </tr>
                  </thead>
                  <tbody>
                    {complianceData.map(v => {
                      const isBoardRole = GOVERNANCE_ROLES.includes(v.role);
                      const isClinical = v.role === 'Licensed Medical Professional' || v.role === 'Medical Admin';
                      const boardForms = ['coi-disclosure', 'confidentiality-agreement', 'code-of-conduct', 'commitment-agreement', 'media-authorization'];
                      const clinicalDocs = ['clinicalOnboardingGuide', 'policiesProcedures', 'screeningConsent', 'standingOrders'];
                      const compCheck = (key: string) => v.compliance?.[key]?.status === 'verified' || v.compliance?.[key]?.status === 'completed';

                      return (
                        <tr key={v.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                          <td className="px-4 py-3 font-bold text-zinc-800 sticky left-0 bg-white">{v.name}</td>
                          <td className="px-3 py-3 text-zinc-500">{v.role}</td>
                          <td className="text-center">{compCheck('backgroundCheck') ? <CheckCircle size={14} className="text-emerald-500 mx-auto" /> : <X size={14} className="text-zinc-200 mx-auto" />}</td>
                          <td className="text-center">{compCheck('hipaaTraining') ? <CheckCircle size={14} className="text-emerald-500 mx-auto" /> : <X size={14} className="text-zinc-200 mx-auto" />}</td>
                          <td className="text-center">{compCheck('training') ? <CheckCircle size={14} className="text-emerald-500 mx-auto" /> : <X size={14} className="text-zinc-200 mx-auto" />}</td>
                          {boardForms.map(fId => (
                            <td key={fId} className="text-center">
                              {!isBoardRole ? <span className="text-zinc-100">—</span> :
                                v.boardFormSignatures[fId] ? (
                                  <button onClick={() => window.open(`/api/board/forms/${fId}/pdf?volunteerId=${v.id}`, '_blank')} title="Download signed PDF">
                                    <CheckCircle size={14} className="text-emerald-500 mx-auto hover:text-brand cursor-pointer" />
                                  </button>
                                ) : <X size={14} className="text-zinc-200 mx-auto" />
                              }
                            </td>
                          ))}
                          {clinicalDocs.map(dId => (
                            <td key={dId} className="text-center">
                              {!isClinical ? <span className="text-zinc-100">—</span> :
                                v.clinicalDocuments[dId]?.signed ? (
                                  <button onClick={() => downloadPdf(`/api/clinical/forms/${dId}/pdf?volunteerId=${v.id}`)} title="Download signed PDF">
                                    <CheckCircle size={14} className="text-emerald-500 mx-auto hover:text-brand cursor-pointer" />
                                  </button>
                                ) : <X size={14} className="text-zinc-200 mx-auto" />
                              }
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-8">
          {filtered.map(v => (
            <div 
              key={v.id} 
              onClick={() => { setSelectedVolunteer(v); setShowFullApplication(false); }}
              className="bg-white p-4 md:p-8 rounded-2xl md:rounded-[40px] border border-zinc-100 shadow-sm hover:shadow-2xl transition-shadow hover:-translate-y-2 transition-all cursor-pointer group flex flex-col justify-between relative overflow-hidden"
            >
               <div className="flex justify-between items-start mb-4 md:mb-8 relative z-10">
                  <div className="flex items-center gap-5">
                     <div className="w-16 h-16 rounded-2xl bg-brand text-white flex items-center justify-center font-black text-xl shadow-elevation-2 overflow-hidden border border-black/10">
                        {v.avatarUrl ? <img src={v.avatarUrl} className="w-full h-full object-cover" /> : v.name.charAt(0)}
                     </div>
                     <div>
                        <h3 className="text-lg font-black text-zinc-900 leading-tight group-hover:text-brand transition-colors">{v.name}</h3>
                        <p className="text-[10px] font-black text-zinc-300 uppercase tracking-[0.15em] mt-1">{v.applicationStatus === 'pendingReview' ? `Applied for: ${v.appliedRole}` : v.role}</p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {v.isReturningVolunteer && (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[8px] font-black uppercase tracking-wider rounded-full">Returning</span>
                          )}
                          {v.isGroupVolunteer && (
                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-[8px] font-black uppercase tracking-wider rounded-full" title={v.groupName}>{v.groupType || 'Group'}</span>
                          )}
                        </div>
                     </div>
                  </div>
                  <button className="p-3 bg-zinc-50 rounded-full text-zinc-200 hover:text-zinc-900 transition-colors"><MoreVertical size={20} /></button>
               </div>

               <div className="bg-zinc-50/50 p-4 md:p-6 rounded-3xl border border-zinc-100/50 mb-4 md:mb-8 relative z-10">
                  <p className="text-[9px] font-bold text-zinc-300 uppercase tracking-wider mb-4">Compliance Status</p>
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
                           <span className="text-[8px] font-bold uppercase tracking-wider">{item.label}</span>
                        </div>
                      )
                    })}
                  </div>
               </div>

               <div className="space-y-4 relative z-10">
                  <div className="flex justify-between items-center text-[11px] font-bold uppercase tracking-wider text-zinc-300 px-1">
                     <span>Onboarding Progress</span>
                     <span className="text-zinc-900">{v.onboardingProgress}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-zinc-50 rounded-full overflow-hidden border border-zinc-100 shadow-inner">
                     <div className="h-full bg-brand transition-all duration-1000 shadow-elevation-1" style={{ width: `${v.onboardingProgress}%` }} />
                  </div>
               </div>

               <div className="mt-10 pt-8 border-t border-zinc-50 flex items-center justify-between relative z-10">
                  <div>
                     <p className="text-[9px] font-bold text-zinc-300 uppercase tracking-wider mb-1">Hours Contributed</p>
                     <p className="text-2xl font-black text-zinc-900 tracking-tighter leading-none">{Math.floor(v.hoursContributed)} <span className="text-xs font-bold text-zinc-300">HRS</span></p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-zinc-50 border border-zinc-100 flex items-center justify-center text-zinc-200 group-hover:bg-brand group-hover:text-white transition-all group-hover:scale-110 shadow-elevation-1">
                     <ChevronRight size={24} />
                  </div>
               </div>
               <div className="absolute -top-10 -right-10 w-40 h-40 bg-brand/5 rounded-full blur-3xl pointer-events-none group-hover:bg-brand/10 transition-all" />
            </div>
          ))}
          
          <button
            onClick={() => setShowAddVolunteerModal(true)}
            className="bg-white border-2 border-dashed border-zinc-100 rounded-2xl md:rounded-[40px] p-4 md:p-8 flex flex-col items-center justify-center text-zinc-300 gap-4 md:gap-6 hover:bg-zinc-50/50 hover:border-brand/20 hover:text-brand transition-all group">
             <div className="w-20 h-20 rounded-full bg-zinc-50 flex items-center justify-center group-hover:bg-white group-hover:shadow-elevation-2 transition-all">
                <UserPlus size={32} strokeWidth={1.5} />
             </div>
             <div className="text-center">
               <p className="text-[11px] font-black uppercase tracking-[0.2em]">Add Volunteer</p>
               <p className="text-[10px] font-bold text-zinc-400 mt-2">Add a new volunteer manually</p>
             </div>
          </button>
        </div>
      </div>
      
      {selectedVolunteer && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-4 md:p-8 animate-in fade-in" onClick={() => setSelectedVolunteer(null)}>
           <div className="bg-white max-w-lg md:max-w-4xl w-full rounded-modal shadow-elevation-3 border border-zinc-100 flex flex-col max-h-[95vh] md:max-h-[90vh]" onClick={e => e.stopPropagation()}>
              <header className="p-4 md:p-8 border-b border-zinc-100 flex items-center justify-between shrink-0">
                 <div className="flex items-center gap-6">
                    <div className="w-20 h-20 rounded-2xl bg-brand text-white flex items-center justify-center font-black text-2xl shadow-elevation-2 overflow-hidden">
                       {selectedVolunteer.avatarUrl ? <img src={selectedVolunteer.avatarUrl} className="w-full h-full object-cover" /> : selectedVolunteer.name.charAt(0)}
                    </div>
                    <div>
                       <h2 className="text-xl md:text-2xl font-black text-zinc-900 tracking-tight">{selectedVolunteer.name}</h2>
                       <p className="text-zinc-400 font-bold uppercase tracking-widest text-xs mt-1">{selectedVolunteer.applicationStatus === 'pendingReview' ? `Applied for: ${selectedVolunteer.appliedRole}` : selectedVolunteer.role}</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-2">
                   {currentUser.isAdmin && (
                     <button onClick={handleStartEditProfile} className="p-4 bg-brand/10 rounded-full text-brand hover:bg-brand/20 transition-colors" title="Edit profile"><Pencil size={20} /></button>
                   )}
                   {currentUser.isAdmin && selectedVolunteer.id !== currentUser.id && (
                     <button onClick={() => setShowDeleteConfirm(true)} className="p-4 bg-rose-50 rounded-full text-rose-300 hover:text-rose-600 transition-colors" title="Delete volunteer"><Trash2 size={20} /></button>
                   )}
                   <button onClick={() => { setSelectedVolunteer(null); setIsEditingProfile(false); }} className="p-4 bg-zinc-50 rounded-full text-zinc-400 hover:text-zinc-900 transition-colors"><X size={24} /></button>
                 </div>
              </header>
              {isEditingProfile ? (
                <main className="p-4 md:p-8 overflow-y-auto space-y-4 md:space-y-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-black text-zinc-900">Edit Profile</h3>
                    <div className="flex gap-2">
                      <button onClick={() => setIsEditingProfile(false)} className="px-4 py-2 text-sm font-bold text-zinc-500 hover:text-zinc-700 border border-zinc-200 rounded-full">Cancel</button>
                      <button onClick={handleSaveProfile} disabled={isSavingProfile} className="px-4 py-2 text-sm font-bold text-white bg-brand border border-black rounded-full shadow-elevation-2 hover:bg-brand-hover disabled:opacity-50 flex items-center gap-2">
                        {isSavingProfile ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Changes
                      </button>
                    </div>
                  </div>

                  {/* Personal Info */}
                  <div className="p-4 md:p-6 bg-zinc-50/70 rounded-3xl border border-zinc-100 space-y-4">
                    <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Personal Information</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em] block mb-1">Legal First Name</label>
                        <input value={editProfileData.legalFirstName} onChange={e => setEditProfileData(p => ({ ...p, legalFirstName: e.target.value }))} className="w-full p-3 bg-white border-2 border-zinc-100 rounded-2xl text-sm font-bold outline-none focus:border-brand/30" />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em] block mb-1">Legal Last Name</label>
                        <input value={editProfileData.legalLastName} onChange={e => setEditProfileData(p => ({ ...p, legalLastName: e.target.value }))} className="w-full p-3 bg-white border-2 border-zinc-100 rounded-2xl text-sm font-bold outline-none focus:border-brand/30" />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em] block mb-1">Preferred First Name</label>
                        <input value={editProfileData.preferredFirstName} onChange={e => setEditProfileData(p => ({ ...p, preferredFirstName: e.target.value }))} className="w-full p-3 bg-white border-2 border-zinc-100 rounded-2xl text-sm font-bold outline-none focus:border-brand/30" />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em] block mb-1">Preferred Last Name</label>
                        <input value={editProfileData.preferredLastName} onChange={e => setEditProfileData(p => ({ ...p, preferredLastName: e.target.value }))} className="w-full p-3 bg-white border-2 border-zinc-100 rounded-2xl text-sm font-bold outline-none focus:border-brand/30" />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em] block mb-1">Date of Birth</label>
                        <input type="date" value={editProfileData.dob} onChange={e => setEditProfileData(p => ({ ...p, dob: e.target.value }))} className="w-full p-3 bg-white border-2 border-zinc-100 rounded-2xl text-sm font-bold outline-none focus:border-brand/30" />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em] block mb-1">Gender</label>
                        <select value={editProfileData.gender} onChange={e => setEditProfileData(p => ({ ...p, gender: e.target.value }))} className="w-full p-3 bg-white border-2 border-zinc-100 rounded-2xl text-sm font-bold outline-none focus:border-brand/30">
                          <option value="">Select...</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Non-binary">Non-binary</option>
                          <option value="Prefer not to say">Prefer not to say</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em] block mb-1">T-Shirt Size</label>
                        <select value={editProfileData.tshirtSize} onChange={e => setEditProfileData(p => ({ ...p, tshirtSize: e.target.value }))} className="w-full p-3 bg-white border-2 border-zinc-100 rounded-2xl text-sm font-bold outline-none focus:border-brand/30">
                          <option value="">Select...</option>
                          <option value="XS">XS</option><option value="S">S</option><option value="M">M</option><option value="L">L</option><option value="XL">XL</option><option value="2XL">2XL</option><option value="3XL">3XL</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em] block mb-1">Applied Role</label>
                        <select value={editProfileData.appliedRole} onChange={e => setEditProfileData(p => ({ ...p, appliedRole: e.target.value }))} className="w-full p-3 bg-white border-2 border-zinc-100 rounded-2xl text-sm font-bold outline-none focus:border-brand/30">
                          <option value="">Select...</option>
                          {APP_CONFIG.HMC_ROLES.map(r => <option key={r.id} value={r.label}>{r.label}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="p-4 md:p-6 bg-zinc-50/70 rounded-3xl border border-zinc-100 space-y-4">
                    <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Contact Information</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em] block mb-1">Phone</label>
                        <input value={editProfileData.phone} onChange={e => setEditProfileData(p => ({ ...p, phone: e.target.value }))} className="w-full p-3 bg-white border-2 border-zinc-100 rounded-2xl text-sm font-bold outline-none focus:border-brand/30" />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em] block mb-1">Address</label>
                        <input value={editProfileData.address} onChange={e => setEditProfileData(p => ({ ...p, address: e.target.value }))} className="w-full p-3 bg-white border-2 border-zinc-100 rounded-2xl text-sm font-bold outline-none focus:border-brand/30" />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em] block mb-1">City</label>
                        <input value={editProfileData.city} onChange={e => setEditProfileData(p => ({ ...p, city: e.target.value }))} className="w-full p-3 bg-white border-2 border-zinc-100 rounded-2xl text-sm font-bold outline-none focus:border-brand/30" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em] block mb-1">State</label>
                          <input value={editProfileData.state} onChange={e => setEditProfileData(p => ({ ...p, state: e.target.value }))} className="w-full p-3 bg-white border-2 border-zinc-100 rounded-2xl text-sm font-bold outline-none focus:border-brand/30" />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em] block mb-1">Zip</label>
                          <input value={editProfileData.zipCode} onChange={e => setEditProfileData(p => ({ ...p, zipCode: e.target.value }))} className="w-full p-3 bg-white border-2 border-zinc-100 rounded-2xl text-sm font-bold outline-none focus:border-brand/30" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Emergency Contact */}
                  <div className="p-4 md:p-6 bg-zinc-50/70 rounded-3xl border border-zinc-100 space-y-4">
                    <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Emergency Contact</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em] block mb-1">Name</label>
                        <input value={editProfileData.eContactName} onChange={e => setEditProfileData(p => ({ ...p, eContactName: e.target.value }))} className="w-full p-3 bg-white border-2 border-zinc-100 rounded-2xl text-sm font-bold outline-none focus:border-brand/30" />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em] block mb-1">Relationship</label>
                        <input value={editProfileData.eContactRelationship} onChange={e => setEditProfileData(p => ({ ...p, eContactRelationship: e.target.value }))} className="w-full p-3 bg-white border-2 border-zinc-100 rounded-2xl text-sm font-bold outline-none focus:border-brand/30" />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em] block mb-1">Phone</label>
                        <input value={editProfileData.eContactCellPhone} onChange={e => setEditProfileData(p => ({ ...p, eContactCellPhone: e.target.value }))} className="w-full p-3 bg-white border-2 border-zinc-100 rounded-2xl text-sm font-bold outline-none focus:border-brand/30" />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em] block mb-1">Email</label>
                        <input value={editProfileData.eContactEmail} onChange={e => setEditProfileData(p => ({ ...p, eContactEmail: e.target.value }))} className="w-full p-3 bg-white border-2 border-zinc-100 rounded-2xl text-sm font-bold outline-none focus:border-brand/30" />
                      </div>
                    </div>
                  </div>

                  {/* Team Lead Designation */}
                  <div className="p-4 md:p-6 bg-zinc-50/70 rounded-3xl border border-zinc-100 space-y-4">
                    <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Team Lead Designation</p>
                    <div className="flex items-center gap-3">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em]">Team Lead</label>
                      <button
                        onClick={() => setEditProfileData(p => ({ ...p, isTeamLead: !p.isTeamLead }))}
                        className={`w-10 h-6 rounded-full transition-colors ${editProfileData.isTeamLead ? 'bg-brand' : 'bg-zinc-200'}`}
                      >
                        <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform mx-1 ${editProfileData.isTeamLead ? 'translate-x-4' : 'translate-x-0'}`} />
                      </button>
                      <span className="text-sm font-bold text-zinc-600">{editProfileData.isTeamLead ? 'Yes' : 'No'}</span>
                    </div>
                    {editProfileData.isTeamLead && (
                      <p className="text-xs text-zinc-500">This volunteer can manage their own team, add existing volunteers, and invite new members.</p>
                    )}
                  </div>

                  {/* Group Volunteer */}
                  <div className="p-4 md:p-6 bg-zinc-50/70 rounded-3xl border border-zinc-100 space-y-4">
                    <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Group / Organization Affiliation</p>
                    <div className="flex items-center gap-3 mb-2">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em]">Group Volunteer</label>
                      <button
                        onClick={() => setEditProfileData(p => ({ ...p, isGroupVolunteer: !p.isGroupVolunteer }))}
                        className={`w-10 h-6 rounded-full transition-colors ${editProfileData.isGroupVolunteer ? 'bg-brand' : 'bg-zinc-200'}`}
                      >
                        <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform mx-1 ${editProfileData.isGroupVolunteer ? 'translate-x-4' : 'translate-x-0'}`} />
                      </button>
                      <span className="text-sm font-bold text-zinc-600">{editProfileData.isGroupVolunteer ? 'Yes' : 'No'}</span>
                    </div>
                    {editProfileData.isGroupVolunteer && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em] block mb-1">Group Type</label>
                          <select value={editProfileData.groupType} onChange={e => setEditProfileData(p => ({ ...p, groupType: e.target.value }))} className="w-full p-3 bg-white border-2 border-zinc-100 rounded-2xl text-sm font-bold outline-none focus:border-brand/30">
                            <option value="">Select...</option>
                            <option value="Student Organization">Student Organization</option>
                            <option value="Faith-Based Group">Faith-Based Group</option>
                            <option value="Corporate Team">Corporate Team</option>
                            <option value="Community Group">Community Group</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em] block mb-1">Organization Name</label>
                          <input value={editProfileData.groupName} onChange={e => setEditProfileData(p => ({ ...p, groupName: e.target.value }))} className="w-full p-3 bg-white border-2 border-zinc-100 rounded-2xl text-sm font-bold outline-none focus:border-brand/30" />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em] block mb-1">Group Size</label>
                          <input value={editProfileData.groupSize} onChange={e => setEditProfileData(p => ({ ...p, groupSize: e.target.value }))} className="w-full p-3 bg-white border-2 border-zinc-100 rounded-2xl text-sm font-bold outline-none focus:border-brand/30" />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em] block mb-1">Group Contact Email</label>
                          <input value={editProfileData.groupContactEmail} onChange={e => setEditProfileData(p => ({ ...p, groupContactEmail: e.target.value }))} className="w-full p-3 bg-white border-2 border-zinc-100 rounded-2xl text-sm font-bold outline-none focus:border-brand/30" />
                        </div>
                      </div>
                    )}
                  </div>
                </main>
              ) : (
              <main className="p-4 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 overflow-y-auto">
                 <div className="space-y-4 md:space-y-8">
                    <div className="space-y-2">
                       <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Contact Info</h4>
                       <div className="p-4 md:p-6 bg-zinc-50 rounded-3xl border border-zinc-100 space-y-3">
                          <p className="flex items-center gap-3 font-bold text-sm text-zinc-700"><Mail size={16} className="text-zinc-300"/> {selectedVolunteer.email}</p>
                          <p className="flex items-center gap-3 font-bold text-sm text-zinc-700"><Phone size={16} className="text-zinc-300"/> {selectedVolunteer.phone}</p>
                       </div>
                    </div>
                    
                    <RoleManagementPanel currentUser={currentUser} selectedVolunteer={selectedVolunteer} onUpdate={handleUpdateVolunteer} />

                    <div className="space-y-2">
                       <div className="flex justify-between items-center">
                         <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Tags</h4>
                         <button onClick={() => setEditingTags(!editingTags)} className="text-xs font-bold">{editingTags ? 'Done' : 'Edit Tags'}</button>
                       </div>
                       <div className="p-4 md:p-6 bg-zinc-50 rounded-3xl border border-zinc-100">
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
                                <input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddTag()} placeholder="Add new tag..." className="flex-1 bg-zinc-50 border-2 border-zinc-100 rounded-2xl p-4 text-sm font-bold outline-none focus:border-brand/30"/>
                                <button onClick={handleAddTag} className="px-3 py-1 bg-zinc-800 border border-black text-white rounded-full text-xs font-bold uppercase tracking-wide shadow-elevation-2">Add</button>
                             </div>
                          )}
                       </div>
                    </div>
                     <div className="space-y-2">
                       <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Achievements</h4>
                       <div className="space-y-2">
                          {selectedVolunteer.achievements.map(a => (
                            <div key={a.id} className="flex items-center gap-3 p-3 bg-zinc-50 rounded-3xl border border-zinc-100">
                               <Award size={16} className="text-amber-400"/>
                               <p className="font-bold text-xs text-zinc-700">{a.title}</p>
                            </div>
                          ))}
                       </div>
                    </div>
                 </div>
                 <div className="space-y-4 md:space-y-6">
                    <div className="bg-zinc-50/70 p-4 md:p-8 rounded-3xl border border-zinc-100 space-y-4 md:space-y-6">
                      <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Compliance Checklist</h4>
                      {Object.values(selectedVolunteer.compliance).map((c: ComplianceStep) => (
                        <div key={c.id} className="flex items-center gap-4">
                          <div className={`w-8 h-8 rounded-2xl flex items-center justify-center border ${c.status === 'verified' || c.status === 'completed' ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-white text-zinc-300 border-zinc-200'}`}><CheckCircle size={16}/></div>
                          <p className={`font-bold text-sm ${c.status === 'verified' || c.status === 'completed' ? 'text-zinc-800' : 'text-zinc-400'}`}>{c.label}</p>
                        </div>
                      ))}
                      {selectedVolunteer.resume?.storagePath && (
                        <button
                          onClick={() => handleDownloadResume(selectedVolunteer.id)}
                          className="mt-4 flex items-center gap-2 px-4 py-2 bg-brand border border-black text-white rounded-full text-xs font-bold uppercase tracking-wide hover:bg-brand-hover transition-all shadow-elevation-2"
                        >
                          <Download size={14} /> Download Resume
                        </button>
                      )}
                    </div>

                    {/* Full Application Details (Collapsible) */}
                    <div className="bg-white rounded-3xl border border-zinc-100 overflow-hidden">
                      <button
                        onClick={() => setShowFullApplication(!showFullApplication)}
                        className="w-full p-6 flex items-center justify-between hover:bg-zinc-50/50 transition-colors"
                      >
                        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                          <FileText size={14} className="text-brand" /> Full Application
                        </h4>
                        <ChevronDown size={16} className={`text-zinc-400 transition-transform duration-200 ${showFullApplication ? 'rotate-180' : ''}`} />
                      </button>
                      {showFullApplication && (
                        <div className="px-6 pb-6 space-y-6 animate-in fade-in">

                          {/* Application Metadata */}
                          <div className="flex items-center gap-3 flex-wrap">
                            {selectedVolunteer.joinedDate && (
                              <span className="px-3 py-1.5 bg-zinc-100 text-zinc-600 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                                <Calendar size={10} /> Applied {new Date(selectedVolunteer.joinedDate).toLocaleDateString()}
                              </span>
                            )}
                            {selectedVolunteer.applicationStatus && (
                              <span className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                selectedVolunteer.applicationStatus === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                                selectedVolunteer.applicationStatus === 'rejected' ? 'bg-rose-100 text-rose-700' :
                                'bg-amber-100 text-amber-700'
                              }`}>
                                {selectedVolunteer.applicationStatus === 'pendingReview' ? 'Pending Review' : selectedVolunteer.applicationStatus}
                              </span>
                            )}
                            {selectedVolunteer.appliedRole && (
                              <span className="px-3 py-1.5 bg-brand/10 text-brand rounded-full text-[10px] font-bold uppercase tracking-wider">
                                Applied: {selectedVolunteer.appliedRole}
                              </span>
                            )}
                          </div>

                          {/* AI Role Matches */}
                          {(selectedVolunteer as any).aiRoleMatches?.length > 0 && (
                            <div className="p-4 bg-zinc-50/70 rounded-3xl border border-zinc-100 space-y-3">
                              <p className="text-[9px] font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5"><Star size={10} /> AI Role Matches</p>
                              <div className="space-y-2">
                                {(selectedVolunteer as any).aiRoleMatches.map((m: any, i: number) => (
                                  <div key={i} className={`p-3 rounded-3xl border ${m.role === selectedVolunteer.appliedRole ? 'bg-brand/5 border-brand/20' : 'bg-white border-zinc-100'}`}>
                                    <div className="flex items-center justify-between">
                                      <p className="text-sm font-bold text-zinc-800 flex items-center gap-2">
                                        {m.role}
                                        {m.role === selectedVolunteer.appliedRole && <span className="px-2 py-0.5 bg-brand text-white rounded-full text-[9px] font-bold uppercase">Selected</span>}
                                      </p>
                                      <span className="text-xs font-bold text-brand">{m.match}% match</span>
                                    </div>
                                    {m.reasoning && <p className="text-xs text-zinc-500 mt-1">{m.reasoning}</p>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Personal Info */}
                          <div className="p-4 bg-zinc-50/70 rounded-3xl border border-zinc-100 space-y-3">
                            <p className="text-[9px] font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5"><User size={10} /> Personal Information</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                              <div>
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Legal First Name</p>
                                <p className="text-sm font-bold text-zinc-800">{selectedVolunteer.legalFirstName || '---'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Legal Last Name</p>
                                <p className="text-sm font-bold text-zinc-800">{selectedVolunteer.legalLastName || '---'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Middle Name</p>
                                <p className="text-sm font-bold text-zinc-800">{selectedVolunteer.middleName || '---'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Preferred First Name</p>
                                <p className="text-sm font-bold text-zinc-800">{selectedVolunteer.preferredFirstName || '---'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Preferred Last Name</p>
                                <p className="text-sm font-bold text-zinc-800">{selectedVolunteer.preferredLastName || '---'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Date of Birth</p>
                                <p className="text-sm font-bold text-zinc-800">{selectedVolunteer.dob ? new Date(selectedVolunteer.dob).toLocaleDateString() : '---'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Gender</p>
                                <p className="text-sm font-bold text-zinc-800">{selectedVolunteer.gender || '---'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">T-Shirt Size</p>
                                <p className="text-sm font-bold text-zinc-800">{selectedVolunteer.tshirtSize || '---'}</p>
                              </div>
                            </div>
                          </div>

                          {/* Contact Info */}
                          <div className="p-4 bg-zinc-50/70 rounded-3xl border border-zinc-100 space-y-3">
                            <p className="text-[9px] font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5"><Mail size={10} /> Contact Information</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                              <div>
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Email</p>
                                <p className="text-sm font-bold text-zinc-800">{selectedVolunteer.email || '---'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Phone</p>
                                <p className="text-sm font-bold text-zinc-800">{selectedVolunteer.phone || '---'}</p>
                              </div>
                              <div className="col-span-2">
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Address</p>
                                <p className="text-sm font-bold text-zinc-800">
                                  {selectedVolunteer.address ? `${selectedVolunteer.address}, ${selectedVolunteer.city || ''}, ${selectedVolunteer.state || ''} ${selectedVolunteer.zipCode || ''}` : '---'}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Emergency Contact */}
                          <div className="p-4 bg-zinc-50/70 rounded-3xl border border-zinc-100 space-y-3">
                            <p className="text-[9px] font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5"><AlertCircle size={10} /> Emergency Contact</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                              <div>
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Name</p>
                                <p className="text-sm font-bold text-zinc-800">{selectedVolunteer.emergencyContact?.name || '---'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Relationship</p>
                                <p className="text-sm font-bold text-zinc-800">{selectedVolunteer.emergencyContact?.relationship || '---'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Phone</p>
                                <p className="text-sm font-bold text-zinc-800">{selectedVolunteer.emergencyContact?.cellPhone || '---'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Email</p>
                                <p className="text-sm font-bold text-zinc-800">{selectedVolunteer.emergencyContact?.email || '---'}</p>
                              </div>
                            </div>
                          </div>

                          {/* Background */}
                          <div className="p-4 bg-zinc-50/70 rounded-3xl border border-zinc-100 space-y-3">
                            <p className="text-[9px] font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5"><Briefcase size={10} /> Background</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                              <div>
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Languages Spoken</p>
                                <p className="text-sm font-bold text-zinc-800">{selectedVolunteer.languagesSpoken?.length ? selectedVolunteer.languagesSpoken.join(', ') : '---'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Student</p>
                                <p className="text-sm font-bold text-zinc-800">{selectedVolunteer.isStudent ? 'Yes' : 'No'}</p>
                              </div>
                              {selectedVolunteer.isStudent && (
                                <>
                                  <div>
                                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">School</p>
                                    <p className="text-sm font-bold text-zinc-800">{selectedVolunteer.school || '---'}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Degree/Program</p>
                                    <p className="text-sm font-bold text-zinc-800">{selectedVolunteer.degree || '---'}</p>
                                  </div>
                                </>
                              )}
                              <div>
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Employed</p>
                                <p className="text-sm font-bold text-zinc-800">{selectedVolunteer.isEmployed ? 'Yes' : 'No'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">How Heard About HMC</p>
                                <p className="text-sm font-bold text-zinc-800">{selectedVolunteer.howDidYouHear || '---'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Returning Volunteer</p>
                                <p className="text-sm font-bold text-zinc-800">{selectedVolunteer.isReturningVolunteer ? 'Yes' : 'No'}</p>
                              </div>
                              {selectedVolunteer.isReturningVolunteer && (
                                <>
                                  <div>
                                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Previous Period</p>
                                    <p className="text-sm font-bold text-zinc-800">{selectedVolunteer.previousVolunteerPeriod || '---'}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Previous Role</p>
                                    <p className="text-sm font-bold text-zinc-800">{selectedVolunteer.previousVolunteerRole || '---'}</p>
                                  </div>
                                </>
                              )}
                              <div>
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Veteran Status</p>
                                <p className="text-sm font-bold text-zinc-800">{selectedVolunteer.demographics?.veteranStatus === true ? 'Yes' : selectedVolunteer.demographics?.veteranStatus === false ? 'No' : 'Not disclosed'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Disability Status</p>
                                <p className="text-sm font-bold text-zinc-800">{selectedVolunteer.demographics?.disabilityStatus === true ? 'Yes' : selectedVolunteer.demographics?.disabilityStatus === false ? 'No' : 'Not disclosed'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Group Volunteer</p>
                                <p className="text-sm font-bold text-zinc-800">{selectedVolunteer.isGroupVolunteer ? 'Yes' : 'No'}</p>
                              </div>
                              {selectedVolunteer.isGroupVolunteer && (
                                <>
                                  <div>
                                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Group Type</p>
                                    <p className="text-sm font-bold text-zinc-800">{selectedVolunteer.groupType || '---'}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Group Name</p>
                                    <p className="text-sm font-bold text-zinc-800">{selectedVolunteer.groupName || '---'}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Group Size</p>
                                    <p className="text-sm font-bold text-zinc-800">{selectedVolunteer.groupSize || '---'}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Group Contact Email</p>
                                    <p className="text-sm font-bold text-zinc-800">{selectedVolunteer.groupContactEmail || '---'}</p>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Availability */}
                          <div className="p-4 bg-zinc-50/70 rounded-3xl border border-zinc-100 space-y-3">
                            <p className="text-[9px] font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5"><Clock size={10} /> Availability</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                              <div>
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Time Commitment</p>
                                <p className="text-sm font-bold text-zinc-800">{selectedVolunteer.timeCommitment || '---'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Service Preference</p>
                                <p className="text-sm font-bold text-zinc-800 capitalize">{selectedVolunteer.availability?.servicePreference || '---'}</p>
                              </div>
                              <div className="col-span-2">
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Available Days</p>
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                  {selectedVolunteer.availability?.days?.length ? selectedVolunteer.availability.days.map(day => (
                                    <span key={day} className="px-2 py-0.5 bg-brand/10 text-brand rounded-full text-[10px] font-bold">{day}</span>
                                  )) : <p className="text-sm text-zinc-400">---</p>}
                                </div>
                              </div>
                              <div>
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Preferred Time</p>
                                <p className="text-sm font-bold text-zinc-800">{selectedVolunteer.availability?.preferredTime || '---'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Start Date</p>
                                <p className="text-sm font-bold text-zinc-800">{selectedVolunteer.availability?.startDate ? new Date(selectedVolunteer.availability.startDate).toLocaleDateString() : '---'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Timezone</p>
                                <p className="text-sm font-bold text-zinc-800">{selectedVolunteer.availability?.timezone || '---'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Hours Per Week</p>
                                <p className="text-sm font-bold text-zinc-800">{selectedVolunteer.availability?.hoursPerWeek || '---'}</p>
                              </div>
                              {selectedVolunteer.availability?.notes && (
                                <div className="col-span-2">
                                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Scheduling Limitations</p>
                                  <p className="text-sm font-bold text-zinc-800">{selectedVolunteer.availability.notes}</p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Role Assessment Q&A */}
                          {(selectedVolunteer.roleAssessment && selectedVolunteer.roleAssessment.length > 0) && (
                            <div className="p-4 bg-zinc-50/70 rounded-3xl border border-zinc-100 space-y-3">
                              <p className="text-[9px] font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5"><ClipboardList size={10} /> Role Assessment Q&A</p>
                              <div className="space-y-3">
                                {selectedVolunteer.roleAssessment.map((qa, i) => (
                                  <div key={i} className="p-3 bg-white rounded-3xl border border-zinc-100">
                                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">{qa.question}</p>
                                    <p className="text-sm text-zinc-600 mt-1 italic">"{qa.answer}"</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* What I Hope to Gain */}
                          {selectedVolunteer.gainFromExperience && (
                            <div className="p-4 bg-zinc-50/70 rounded-3xl border border-zinc-100 space-y-3">
                              <p className="text-[9px] font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5"><Star size={10} /> What I Hope to Gain</p>
                              <p className="text-sm text-zinc-700 italic">"{selectedVolunteer.gainFromExperience}"</p>
                            </div>
                          )}

                          {/* Resume */}
                          {selectedVolunteer.resume && (
                            <div className="p-4 bg-zinc-50/70 rounded-3xl border border-zinc-100 space-y-3">
                              <p className="text-[9px] font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5"><FileText size={10} /> Resume</p>
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-bold text-zinc-700">{selectedVolunteer.resume.name || 'Resume on file'}</p>
                                <button
                                  onClick={() => handleDownloadResume(selectedVolunteer.id)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-brand border border-black text-white rounded-full text-[10px] font-bold uppercase tracking-wide hover:bg-brand-hover transition-all shadow-elevation-2"
                                >
                                  <Download size={12} /> Download
                                </button>
                              </div>
                            </div>
                          )}

                        </div>
                      )}

                          {/* Clinical Credentials */}
                          {selectedVolunteer.clinicalOnboarding?.credentials && (
                            <div className="p-4 bg-zinc-50/70 rounded-3xl border border-zinc-100 space-y-3">
                              <p className="text-[9px] font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5"><ShieldCheck size={10} /> Clinical Credentials</p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                                <div>
                                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">NPI Number</p>
                                  <p className="text-sm font-bold text-zinc-800">{selectedVolunteer.clinicalOnboarding.credentials.npi || '---'}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">License Number</p>
                                  <p className="text-sm font-bold text-zinc-800">{selectedVolunteer.clinicalOnboarding.credentials.licenseNumber || '---'}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">License State</p>
                                  <p className="text-sm font-bold text-zinc-800">{selectedVolunteer.clinicalOnboarding.credentials.licenseState || '---'}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">License Expiration</p>
                                  <p className="text-sm font-bold text-zinc-800">{selectedVolunteer.clinicalOnboarding.credentials.licenseExpiration ? new Date(selectedVolunteer.clinicalOnboarding.credentials.licenseExpiration).toLocaleDateString() : '---'}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">License File</p>
                                  <p className="text-sm font-bold text-zinc-800">{selectedVolunteer.clinicalOnboarding.credentials.licenseFileUrl ? (
                                    <button onClick={() => handleViewCredentialFile(selectedVolunteer.id, 'licenseFileUrl')} className="text-brand hover:underline">View Upload</button>
                                  ) : '---'}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">DEA Number</p>
                                  <p className="text-sm font-bold text-zinc-800">{selectedVolunteer.clinicalOnboarding.credentials.deaNumber || '---'}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">DEA Expiration</p>
                                  <p className="text-sm font-bold text-zinc-800">{selectedVolunteer.clinicalOnboarding.credentials.deaExpiration ? new Date(selectedVolunteer.clinicalOnboarding.credentials.deaExpiration).toLocaleDateString() : '---'}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Board Certification</p>
                                  <p className="text-sm font-bold text-zinc-800">{selectedVolunteer.clinicalOnboarding.credentials.boardCertification || '---'}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Board Cert Expiration</p>
                                  <p className="text-sm font-bold text-zinc-800">{selectedVolunteer.clinicalOnboarding.credentials.boardCertExpiration ? new Date(selectedVolunteer.clinicalOnboarding.credentials.boardCertExpiration).toLocaleDateString() : '---'}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Malpractice Insurance</p>
                                  <p className={`text-sm font-bold ${selectedVolunteer.clinicalOnboarding.credentials.malpracticeInsurance ? 'text-emerald-600' : 'text-rose-500'}`}>
                                    {selectedVolunteer.clinicalOnboarding.credentials.malpracticeInsurance ? 'Yes' : 'No'}
                                  </p>
                                </div>
                                {selectedVolunteer.clinicalOnboarding.credentials.malpracticeFileUrl && (
                                  <div>
                                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Malpractice File</p>
                                    <button onClick={() => handleViewCredentialFile(selectedVolunteer.id, 'malpracticeFileUrl')} className="text-sm font-bold text-brand hover:underline">View Upload</button>
                                  </div>
                                )}
                              </div>
                              {selectedVolunteer.clinicalOnboarding.completedAt && (
                                <p className="text-[10px] text-zinc-400 font-bold mt-2">Onboarding completed: {new Date(selectedVolunteer.clinicalOnboarding.completedAt).toLocaleDateString()}</p>
                              )}
                            </div>
                          )}

                          {/* Clinical Credentials (Summary) */}
                          {selectedVolunteer.clinicalOnboarding?.credentials && (
                            <div className="mt-4">
                              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2">Clinical Credentials</p>
                              <div className="grid grid-cols-2 gap-2">
                                {selectedVolunteer.clinicalOnboarding.credentials.npiNumber && (
                                  <div className="p-2 bg-zinc-50 rounded-xl">
                                    <p className="text-[9px] font-bold text-zinc-400 uppercase">NPI</p>
                                    <p className="text-xs font-bold text-zinc-700">{selectedVolunteer.clinicalOnboarding.credentials.npiNumber}</p>
                                  </div>
                                )}
                                {selectedVolunteer.clinicalOnboarding.credentials.licenseNumber && (
                                  <div className="p-2 bg-zinc-50 rounded-xl">
                                    <p className="text-[9px] font-bold text-zinc-400 uppercase">License #</p>
                                    <p className="text-xs font-bold text-zinc-700">{selectedVolunteer.clinicalOnboarding.credentials.licenseNumber}</p>
                                  </div>
                                )}
                                {selectedVolunteer.clinicalOnboarding.credentials.licenseState && (
                                  <div className="p-2 bg-zinc-50 rounded-xl">
                                    <p className="text-[9px] font-bold text-zinc-400 uppercase">State</p>
                                    <p className="text-xs font-bold text-zinc-700">{selectedVolunteer.clinicalOnboarding.credentials.licenseState}</p>
                                  </div>
                                )}
                                {selectedVolunteer.clinicalOnboarding.credentials.licenseExpiration && (
                                  <div className="p-2 bg-zinc-50 rounded-xl">
                                    <p className="text-[9px] font-bold text-zinc-400 uppercase">Expires</p>
                                    <p className="text-xs font-bold text-zinc-700">{selectedVolunteer.clinicalOnboarding.credentials.licenseExpiration}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Completed Training Modules */}
                          {selectedVolunteer.completedTrainingIds && selectedVolunteer.completedTrainingIds.length > 0 && (
                            <div className="mt-4">
                              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2">Completed Training ({selectedVolunteer.completedTrainingIds.length})</p>
                              <div className="flex flex-wrap gap-1.5">
                                {selectedVolunteer.completedTrainingIds.map((id: string) => (
                                  <span key={id} className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-bold border border-emerald-100">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    {id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                    </div>

                    {/* Task Assignment Section */}
                    <div className="bg-white p-4 md:p-6 rounded-3xl border border-zinc-100 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Assigned Tasks</h4>
                        <button
                          onClick={() => setShowTaskModal(true)}
                          className="px-3 py-1.5 bg-brand border border-black text-white rounded-full text-xs font-bold uppercase tracking-wide flex items-center gap-1 shadow-elevation-2"
                        >
                          <ClipboardList size={12} /> Assign Task
                        </button>
                      </div>
                      {selectedVolunteer.tasks && selectedVolunteer.tasks.length > 0 ? (
                        <div className="space-y-2">
                          {selectedVolunteer.tasks.map(task => (
                            <div key={task.id} className={`p-4 rounded-3xl border ${task.status === 'completed' ? 'bg-emerald-50 border-emerald-100' : 'bg-zinc-50 border-zinc-100'}`}>
                              <div className="flex items-start justify-between">
                                <div>
                                  <p className={`font-bold text-sm ${task.status === 'completed' ? 'text-emerald-700 line-through' : 'text-zinc-800'}`}>{task.title}</p>
                                  <p className="text-sm text-zinc-600 mt-1">{task.description}</p>
                                </div>
                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${task.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                  {task.status}
                                </span>
                              </div>
                              {task.dueDate && (
                                <p className="text-[10px] text-zinc-400 mt-2">Due: {new Date(task.dueDate).toLocaleDateString()}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-zinc-400 font-bold text-sm text-center py-4">No tasks assigned yet</p>
                      )}
                    </div>
                 </div>
                 {selectedVolunteer.applicationStatus === 'pendingReview' && <ApplicationReviewPanel volunteer={selectedVolunteer} onReview={handleReview} isReviewing={isReviewing} />}
              </main>
              )}
           </div>
        </div>
      )}
      
      {showImportModal && <BulkImportModal onClose={() => setShowImportModal(false)} setVolunteers={setVolunteers} />}
      {showAddVolunteerModal && <AddVolunteerModal onClose={() => setShowAddVolunteerModal(false)} setVolunteers={setVolunteers} />}

      {/* Task Assignment Modal */}
      {showTaskModal && selectedVolunteer && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-4 md:p-8 animate-in fade-in" onClick={() => setShowTaskModal(false)}>
          <div className="bg-white max-w-lg w-full rounded-modal shadow-elevation-3 border border-zinc-100 p-4 md:p-8 space-y-4 md:space-y-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-zinc-900 tracking-tight">Assign Task</h2>
              <button onClick={() => setShowTaskModal(false)} className="p-2 bg-zinc-100 rounded-full text-zinc-400 hover:text-zinc-900">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-zinc-600">Assign a task to <span className="font-bold text-zinc-800">{selectedVolunteer.name}</span></p>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Task Title *</label>
                <input
                  type="text"
                  required
                  value={taskTitle}
                  onChange={e => setTaskTitle(e.target.value)}
                  placeholder="e.g., Complete HIPAA Training"
                  className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Description</label>
                <textarea
                  value={taskDescription}
                  onChange={e => setTaskDescription(e.target.value)}
                  placeholder="Provide details about the task..."
                  className="w-full min-h-[100px] p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 resize-none font-bold text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Due Date (Optional)</label>
                <input
                  type="date"
                  value={taskDueDate}
                  onChange={e => setTaskDueDate(e.target.value)}
                  className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm"
                />
              </div>
            </div>

            <button
              onClick={handleAssignTask}
              disabled={isAssigningTask || !taskTitle.trim()}
              className="w-full py-4 bg-brand border border-black text-white rounded-full font-bold text-sm uppercase tracking-wide flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform disabled:opacity-50 shadow-elevation-2"
            >
              {isAssigningTask ? <Loader2 size={18} className="animate-spin" /> : <><ClipboardList size={18} /> Assign Task</>}
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedVolunteer && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-4 md:p-8 animate-in fade-in" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-white max-w-md w-full rounded-modal shadow-elevation-3 border border-zinc-100 p-4 md:p-8 space-y-4 md:space-y-6" onClick={e => e.stopPropagation()}>
            <div className="text-center">
              <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={28} className="text-rose-500" />
              </div>
              <h2 className="text-base md:text-xl font-bold text-zinc-900">Delete Volunteer?</h2>
              <p className="text-sm text-zinc-600 mt-2">
                This will permanently delete <span className="font-bold text-zinc-800">{selectedVolunteer.name}</span>'s account, remove them from all assigned shifts, and delete their login credentials. This cannot be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-3 bg-zinc-100 text-zinc-700 rounded-full font-bold text-sm uppercase tracking-wide">Cancel</button>
              <button onClick={handleDeleteVolunteer} disabled={isDeleting} className="flex-1 py-3 bg-rose-500 border border-black text-white rounded-full font-bold text-sm uppercase tracking-wide flex items-center justify-center gap-2 hover:bg-rose-600 disabled:opacity-50">
                {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const RoleManagementPanel: React.FC<{currentUser: Volunteer, selectedVolunteer: Volunteer, onUpdate: (v: Volunteer) => void}> = ({currentUser, selectedVolunteer, onUpdate}) => {
    const [isEditingRole, setIsEditingRole] = useState(false);
    const [newRole, setNewRole] = useState(selectedVolunteer.role);

    const handleSaveRole = () => {
        onUpdate({ ...selectedVolunteer, role: newRole, volunteerRole: newRole as Volunteer['volunteerRole'] });
        setIsEditingRole(false);
    }
    
    const handlePromote = () => {
        const updatedTags = [...(selectedVolunteer.tags || []).filter(t => t !== 'Shift Lead'), 'Shift Lead'];
        onUpdate({ ...selectedVolunteer, tags: updatedTags });
    }

    if (!currentUser.isAdmin && currentUser.role !== 'Volunteer Lead') return null;

    return (
        <div className="space-y-2">
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Role Management</h4>
            <div className="p-4 md:p-6 bg-zinc-50 rounded-3xl border border-zinc-100">
                {currentUser.isAdmin ? (
                    isEditingRole ? (
                        <div className="space-y-4">
                            <select value={newRole} onChange={e => setNewRole(e.target.value)} className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl font-bold text-sm">
                                {APP_CONFIG.HMC_ROLES.map(r => <option key={r.id} value={r.label}>{r.label}</option>)}
                            </select>
                            <div className="flex gap-2">
                                <button onClick={() => setIsEditingRole(false)} className="flex-1 text-xs font-bold py-2 border border-black rounded-full uppercase tracking-wide">Cancel</button>
                                <button onClick={handleSaveRole} className="flex-1 text-xs font-bold py-2 bg-zinc-800 border border-black text-white rounded-full uppercase tracking-wide shadow-elevation-2">Save Role</button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between">
                            <p className="font-bold">{selectedVolunteer.role}</p>
                            <button onClick={() => setIsEditingRole(true)} className="text-xs font-bold">Edit Role</button>
                        </div>
                    )
                ) : currentUser.role === 'Volunteer Lead' ? (
                     <button onClick={handlePromote} className="w-full text-center py-3 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold uppercase tracking-wide">
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
        <div className="md:col-span-2 bg-amber-50 p-4 md:p-6 rounded-3xl border-2 border-amber-200 space-y-4 animate-in fade-in">
            <h3 className="text-sm font-bold text-amber-800 uppercase tracking-wider">Application Review for: {volunteer.appliedRole}</h3>
            {volunteer.roleAssessment && volunteer.roleAssessment.length > 0 && (
                <div className="space-y-3">
                    {volunteer.roleAssessment.map((qa, i) => (
                        <div key={i} className="bg-white/60 p-4 rounded-3xl">
                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">{qa.question}</p>
                            <p className="text-sm text-zinc-600 italic mt-1">"{qa.answer}"</p>
                        </div>
                    ))}
                </div>
            )}
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add review notes (optional)..." className="w-full h-24 p-4 text-sm font-bold bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30" />
            <div className="flex items-center gap-4">
                <button onClick={() => onReview('approve', notes)} disabled={isReviewing} className="flex-1 py-4 bg-brand border border-black text-white rounded-full font-bold text-xs uppercase tracking-wide flex items-center justify-center gap-2 hover:bg-emerald-700 disabled:opacity-50 shadow-elevation-2">
                    {isReviewing ? <Loader2 size={16} className="animate-spin" /> : <><Check size={16}/> Approve for Role</>}
                </button>
                <button onClick={() => onReview('reject', notes)} disabled={isReviewing} className="flex-1 py-4 bg-brand border border-black text-white rounded-full font-bold text-xs uppercase tracking-wide flex items-center justify-center gap-2 hover:bg-indigo-700 disabled:opacity-50 shadow-elevation-2">
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-4 md:p-8 animate-in fade-in" onClick={onClose}>
            <div className="bg-white max-w-2xl w-full rounded-modal shadow-elevation-3 border border-zinc-100 p-4 md:p-8 space-y-4 md:space-y-8" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-black text-zinc-900 tracking-tight">Bulk Import Volunteers</h2>
                <p className="text-base text-zinc-500 font-medium">Upload a CSV file to migrate existing volunteers. The system will create their accounts and send them a welcome email to set their password and complete their profile.</p>
                
                <div className="p-4 md:p-6 bg-zinc-50 border border-zinc-100 rounded-3xl text-xs text-zinc-500">
                    <p className="font-bold mb-2">Required CSV Format:</p>
                    <code className="font-mono">email,legalFirstName,legalLastName,role,joinedDate,hoursContributed</code>
                </div>

                {successCount !== null ? (
                    <div className="p-4 md:p-8 bg-emerald-50 border border-emerald-200 rounded-3xl text-center">
                        <CheckCircle className="mx-auto text-emerald-500 mb-4" size={48} />
                        <h3 className="font-black text-emerald-800">Import Successful</h3>
                        <p className="text-emerald-700">{successCount} volunteers have been imported and sent a welcome email.</p>
                        <button onClick={onClose} className="mt-4 px-4 py-2 bg-brand border border-black text-white text-xs font-bold rounded-full uppercase tracking-wide shadow-elevation-2">Done</button>
                    </div>
                ) : (
                    <>
                        <input type="file" accept=".csv" onChange={handleFileChange} className="w-full text-sm text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-brand/5 file:text-brand hover:file:bg-brand/10"/>
                        {error && <p className="text-rose-500 text-sm text-center font-bold">{error}</p>}
                        <button onClick={handleUpload} disabled={isUploading || !file} className="w-full py-5 bg-brand border border-black text-white rounded-full font-bold text-sm uppercase tracking-wide flex items-center justify-center gap-4 disabled:opacity-50 shadow-elevation-2">
                            {isUploading ? <Loader2 className="animate-spin"/> : "Start Import"}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

const AddVolunteerModal: React.FC<{onClose: () => void, setVolunteers: Function}> = ({ onClose, setVolunteers }) => {
    const [formData, setFormData] = useState({
        legalFirstName: '',
        legalLastName: '',
        email: '',
        phone: '',
        role: 'Core Volunteer',
        password: '',
        sendPasswordReset: true
    });
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
      return () => {
        if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      };
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.legalFirstName || !formData.legalLastName || !formData.email) {
            setError('Please fill in all required fields.');
            return;
        }
        setIsSaving(true);
        setError('');
        try {
            const newVolunteer = {
                legalFirstName: formData.legalFirstName,
                legalLastName: formData.legalLastName,
                name: `${formData.legalFirstName} ${formData.legalLastName}`,
                email: formData.email,
                phone: formData.phone,
                role: formData.role,
                tenantId: 'hmc-health',
                status: 'onboarding',
                isNewUser: true,
                identityLabel: 'HMC Champion',
                volunteerRole: formData.role,
                joinedDate: new Date().toISOString(),
                onboardingProgress: 0,
                hoursContributed: 0,
                points: 0,
                isAdmin: false,
                coreVolunteerStatus: false,
                compliance: {
                    application: { id: 'application', label: 'Application', status: 'pending' },
                    backgroundCheck: { id: 'backgroundCheck', label: 'Background Check', status: 'pending' },
                    hipaaTraining: { id: 'hipaaTraining', label: 'HIPAA Training', status: 'pending' },
                    training: { id: 'training', label: 'Baseline Training', status: 'pending' },
                    orientation: { id: 'orientation', label: 'Orientation', status: 'pending' },
                },
                skills: [],
                tasks: [],
                achievements: [],
                availability: {
                    days: [],
                    preferredTime: 'Any',
                    startDate: new Date().toISOString().split('T')[0]
                },
                eventEligibility: {
                    canDeployCore: false,
                    streetMedicineGate: false,
                    clinicGate: false,
                    healthFairGate: false,
                    naloxoneDistribution: false,
                    oraQuickDistribution: false,
                    qualifiedEventTypes: []
                }
            };

            const result = await apiService.post('/api/admin/add-volunteer', {
                volunteer: newVolunteer,
                password: formData.password || undefined,
                sendPasswordReset: formData.sendPasswordReset
            });
            setVolunteers((prev: Volunteer[]) => [...prev, { id: result.id, ...newVolunteer }]);
            setSuccess(true);
            closeTimerRef.current = setTimeout(onClose, 2000);
        } catch(e) {
            setError((e as Error).message || 'Failed to add volunteer');
        } finally {
            setIsSaving(false);
        }
    };

    if (success) {
        return (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-4 md:p-8 animate-in fade-in">
                <div className="bg-white max-w-lg w-full rounded-modal shadow-elevation-3 border border-zinc-100 p-4 md:p-8 text-center">
                    <CheckCircle className="mx-auto text-emerald-500 mb-4" size={64} />
                    <h3 className="text-2xl font-black text-emerald-800">Volunteer Added!</h3>
                    <p className="text-base text-zinc-500 font-medium mt-2">They will receive a welcome email to set up their account.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-4 md:p-8 animate-in fade-in" onClick={onClose}>
            <div className="bg-white max-w-lg w-full rounded-modal shadow-elevation-3 border border-zinc-100 p-4 md:p-8 space-y-4 md:space-y-6" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-black text-zinc-900 tracking-tight">Add Volunteer</h2>
                    <button onClick={onClose} className="p-2 bg-zinc-100 rounded-full text-zinc-400 hover:text-zinc-900">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">First Name *</label>
                            <input
                                type="text"
                                value={formData.legalFirstName}
                                onChange={e => setFormData({...formData, legalFirstName: e.target.value})}
                                className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm"
                                placeholder="John"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Last Name *</label>
                            <input
                                type="text"
                                value={formData.legalLastName}
                                onChange={e => setFormData({...formData, legalLastName: e.target.value})}
                                className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm"
                                placeholder="Doe"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Email *</label>
                        <input
                            type="email"
                            value={formData.email}
                            onChange={e => setFormData({...formData, email: e.target.value})}
                            className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm"
                            placeholder="john@example.com"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Phone</label>
                        <input
                            type="tel"
                            value={formData.phone}
                            onChange={e => setFormData({...formData, phone: e.target.value})}
                            className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm"
                            placeholder="(555) 123-4567"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Role</label>
                        <select
                            value={formData.role}
                            onChange={e => setFormData({...formData, role: e.target.value})}
                            className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm"
                        >
                            {APP_CONFIG.HMC_ROLES.map(role => (
                                <option key={role.id} value={role.label}>{role.label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="pt-2 border-t border-zinc-100">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Temporary Password</label>
                        <input
                            type="password"
                            value={formData.password}
                            onChange={e => setFormData({...formData, password: e.target.value})}
                            className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm"
                            placeholder="Enter a temporary password"
                        />
                        <p className="text-xs text-zinc-400 mt-1">Min 6 characters. Volunteer will be asked to reset on first login.</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            id="sendPasswordReset"
                            checked={formData.sendPasswordReset}
                            onChange={e => setFormData({...formData, sendPasswordReset: e.target.checked})}
                            className="w-4 h-4 rounded border-zinc-300"
                        />
                        <label htmlFor="sendPasswordReset" className="text-sm text-zinc-600">
                            Send password reset email (recommended)
                        </label>
                    </div>

                    {error && <p className="text-rose-500 text-sm text-center font-bold">{error}</p>}

                    <button
                        type="submit"
                        disabled={isSaving}
                        className="w-full py-4 bg-brand border border-black text-white rounded-full font-bold text-sm uppercase tracking-wide flex items-center justify-center gap-2 disabled:opacity-50 shadow-elevation-2"
                    >
                        {isSaving ? <Loader2 className="animate-spin" size={18} /> : <><UserPlus size={18} /> Add Volunteer</>}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default AdminVolunteerDirectory;
