import React, { useState, useEffect } from 'react';
import { Volunteer } from '../types';
import { Users, UserCheck, Calendar, MessageSquare, Search, UserPlus, X, Mail, Loader2, Trash2, CheckCircle } from 'lucide-react';
import { apiService } from '../services/apiService';
import { toastService } from '../services/toastService';

interface CoordinatorViewProps {
  user: Volunteer;
  allVolunteers: Volunteer[];
  onNavigate?: (tab: string) => void;
}

const CoordinatorView: React.FC<CoordinatorViewProps> = ({ user, allVolunteers, onNavigate }) => {
  const myTeam = allVolunteers.filter(v => v.managedBy === user.id);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [upcomingShifts, setUpcomingShifts] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [addSearchQuery, setAddSearchQuery] = useState('');
  const [isAdding, setIsAdding] = useState('');
  const [isRemoving, setIsRemoving] = useState('');
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', groupName: '' });
  const [isInviting, setIsInviting] = useState(false);

  useEffect(() => {
    const pending = myTeam.filter(v => v.status === 'onboarding' || v.status === 'applicant').length;
    setPendingApprovals(pending);
    const teamShiftCount = myTeam.reduce((count, v) => count + (v.assignedShiftIds?.length || 0), 0);
    setUpcomingShifts(teamShiftCount);
  }, [allVolunteers, user.id]);

  const activeCount = myTeam.filter(v => v.status === 'active').length;

  // Filter team roster by search
  const filteredTeam = myTeam.filter(v =>
    !searchQuery || v.name.toLowerCase().includes(searchQuery.toLowerCase()) || v.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Volunteers available to add (not self, not already managed)
  const availableToAdd = allVolunteers.filter(v =>
    v.id !== user.id &&
    !v.managedBy &&
    (addSearchQuery.length >= 2 && (
      v.name.toLowerCase().includes(addSearchQuery.toLowerCase()) ||
      v.email?.toLowerCase().includes(addSearchQuery.toLowerCase())
    ))
  );

  const handleAddMember = async (volunteerId: string) => {
    setIsAdding(volunteerId);
    try {
      await apiService.post('/api/team/add-member', { volunteerId });
      toastService.success('Volunteer added to your team.');
      setShowAddModal(false);
      setAddSearchQuery('');
    } catch (err: any) {
      toastService.error(err?.message || 'Failed to add volunteer.');
    } finally {
      setIsAdding('');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    setIsRemoving(memberId);
    try {
      await apiService.delete(`/api/team/remove-member/${memberId}`);
      toastService.success('Volunteer removed from your team.');
      setConfirmRemove(null);
    } catch (err: any) {
      toastService.error(err?.message || 'Failed to remove volunteer.');
    } finally {
      setIsRemoving('');
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteForm.name || !inviteForm.email) return;
    setIsInviting(true);
    try {
      const result = await apiService.post('/api/team/invite', inviteForm);
      if (result.alreadyRegistered) {
        toastService.info(`${result.volunteerName} is already registered. Use "Add Existing Volunteer" instead.`);
      } else {
        toastService.success(`Invite sent to ${inviteForm.email}.`);
        setInviteForm({ name: '', email: '', groupName: '' });
        setShowInviteForm(false);
      }
    } catch (err: any) {
      toastService.error(err?.message || 'Failed to send invite.');
    } finally {
      setIsInviting(false);
    }
  };

  const inputClass = "w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm";
  const labelClass = "text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em] block mb-2";

  return (
    <div className="space-y-10 animate-in fade-in">
      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        <StatCard title="Team Size" value={myTeam.length} icon={Users} accent="brand" />
        <StatCard title="Active" value={activeCount} icon={UserCheck} accent="emerald" />
        <StatCard title="Onboarding" value={pendingApprovals} icon={UserPlus} accent="amber" />
        <StatCard title="Total Shifts" value={upcomingShifts} icon={Calendar} accent="brand" />
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-4">
        <button onClick={() => setShowAddModal(true)} className="w-full sm:w-auto min-h-[44px] px-6 py-3 bg-brand border border-black text-white rounded-full text-sm font-bold uppercase tracking-wide flex items-center justify-center gap-2 hover:bg-brand/90 transition-colors">
          <UserPlus size={16} /> Add Existing Volunteer
        </button>
        <button onClick={() => setShowInviteForm(true)} className="w-full sm:w-auto min-h-[44px] px-6 py-3 bg-white border-2 border-dashed border-zinc-300 text-zinc-700 rounded-full text-sm font-bold uppercase tracking-wide flex items-center justify-center gap-2 hover:border-brand/30 hover:text-brand transition-colors">
          <Mail size={16} /> Invite New Volunteer
        </button>
      </div>

      {/* Invite Form */}
      {showInviteForm && (
        <div className="bg-white p-4 md:p-8 rounded-2xl md:rounded-[40px] border border-zinc-100 shadow-sm hover:shadow-2xl transition-shadow">
          <div className="flex items-center justify-between mb-4 md:mb-6">
            <h3 className="text-base md:text-xl font-black text-zinc-900 tracking-tight uppercase">Invite New Volunteer</h3>
            <button onClick={() => setShowInviteForm(false)} className="p-2 hover:bg-zinc-100 rounded-2xl"><X size={20} /></button>
          </div>
          <form onSubmit={handleInvite} className="space-y-4 max-w-lg">
            <div>
              <label className={labelClass}>Full Name *</label>
              <input required value={inviteForm.name} onChange={e => setInviteForm({ ...inviteForm, name: e.target.value })} placeholder="Jane Doe" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Email *</label>
              <input required type="email" value={inviteForm.email} onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })} placeholder="jane@example.com" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Group / Organization (Optional)</label>
              <input value={inviteForm.groupName} onChange={e => setInviteForm({ ...inviteForm, groupName: e.target.value })} placeholder="e.g., UCLA Pre-Med Society" className={inputClass} />
            </div>
            <div className="flex gap-4">
              <button type="button" onClick={() => setShowInviteForm(false)} className="flex-1 py-3 bg-white border border-black text-zinc-900 hover:bg-zinc-200 rounded-full text-sm font-bold uppercase tracking-wide">Cancel</button>
              <button type="submit" disabled={isInviting} className="flex-1 py-3 bg-brand border border-black text-white rounded-full text-sm font-bold uppercase tracking-wide disabled:opacity-50 flex items-center justify-center gap-2">
                {isInviting ? <><Loader2 size={14} className="animate-spin" /> Sending...</> : <><Mail size={14} /> Send Invite</>}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Existing Volunteer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-2xl md:rounded-[40px] max-w-lg w-full shadow-elevation-3 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-4 md:p-6 border-b border-zinc-100 flex items-center justify-between shrink-0">
              <h3 className="text-base md:text-xl font-black text-zinc-900 tracking-tight uppercase">Add Volunteer to Team</h3>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-zinc-100 rounded-2xl"><X size={20} /></button>
            </div>
            <div className="p-4 md:p-6 space-y-4 flex-1 overflow-y-auto">
              <div className="relative">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  autoFocus
                  value={addSearchQuery}
                  onChange={e => setAddSearchQuery(e.target.value)}
                  placeholder="Search by name or email (min 2 chars)..."
                  className="w-full pl-11 p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm"
                />
              </div>
              {addSearchQuery.length >= 2 && (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {availableToAdd.length > 0 ? availableToAdd.slice(0, 20).map(v => (
                    <div key={v.id} className="p-4 bg-zinc-50 border border-zinc-100 rounded-2xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-zinc-200 flex items-center justify-center font-bold text-sm">{v.name?.charAt(0)}</div>
                        <div>
                          <p className="font-bold text-zinc-800 text-sm">{v.name}</p>
                          <p className="text-xs text-zinc-500">{v.role} · {v.email}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleAddMember(v.id)}
                        disabled={isAdding === v.id}
                        className="px-4 py-2 bg-brand border border-black text-white rounded-full text-xs font-bold uppercase tracking-wide disabled:opacity-50 flex items-center gap-1"
                      >
                        {isAdding === v.id ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={12} />} Add
                      </button>
                    </div>
                  )) : (
                    <p className="text-sm text-zinc-400 text-center py-6">No available volunteers match your search.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Team Roster */}
      <div className="bg-white p-4 md:p-8 rounded-2xl md:rounded-[40px] border border-zinc-100 shadow-sm hover:shadow-2xl transition-shadow">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 md:mb-6 gap-3">
          <h3 className="text-xl md:text-2xl font-black text-zinc-900 tracking-tight uppercase">Team Roster</h3>
          {myTeam.length > 3 && (
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Filter team..."
                className="pl-9 pr-4 py-2 bg-zinc-50 border border-zinc-100 rounded-full text-sm font-bold outline-none focus:border-brand/30 w-56"
              />
            </div>
          )}
        </div>
        <div className="space-y-3">
          {filteredTeam.length > 0 ? filteredTeam.map(v => (
            <div key={v.id} className="p-4 md:p-5 bg-zinc-50 border border-zinc-100 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-zinc-200 flex items-center justify-center font-bold">{v.name?.charAt(0)}</div>
                <div>
                  <p className="font-bold text-zinc-800">{v.name}</p>
                  <p className="text-xs text-zinc-500">{v.role} · {v.email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${v.status === 'active' ? 'bg-emerald-100 text-emerald-700' : v.status === 'onboarding' ? 'bg-amber-100 text-amber-700' : 'bg-zinc-100 text-zinc-500'}`}>
                      {v.status}
                    </span>
                    {(v.assignedShiftIds?.length || 0) > 0 && (
                      <span className="text-[10px] text-zinc-400 font-bold">{v.assignedShiftIds?.length} shift{(v.assignedShiftIds?.length || 0) > 1 ? 's' : ''}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onNavigate?.('messages')}
                  className="text-xs font-bold bg-white border border-black px-4 py-2 rounded-full flex items-center gap-2 uppercase tracking-wide hover:bg-zinc-100"
                >
                  <MessageSquare size={14} /> Message
                </button>
                {confirmRemove === v.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleRemoveMember(v.id)}
                      disabled={isRemoving === v.id}
                      className="text-xs font-bold bg-rose-500 text-white px-3 py-2 rounded-full flex items-center gap-1 disabled:opacity-50"
                    >
                      {isRemoving === v.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />} Confirm
                    </button>
                    <button onClick={() => setConfirmRemove(null)} className="text-xs font-bold bg-zinc-100 text-zinc-600 px-3 py-2 rounded-full">Cancel</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmRemove(v.id)}
                    className="p-2 text-zinc-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors"
                    title="Remove from team"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          )) : (
            <p className="text-zinc-400 font-bold text-sm text-center py-8">
              {searchQuery ? 'No team members match your filter.' : 'You currently do not manage any volunteers. Use the buttons above to add or invite team members.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

const statCardThemes = {
  brand: { border: 'border-l-brand', iconBg: 'bg-gradient-to-br from-brand/10 to-indigo-100/50', iconText: 'text-brand' },
  emerald: { border: 'border-l-emerald-400', iconBg: 'bg-gradient-to-br from-emerald-500/10 to-emerald-100/50', iconText: 'text-emerald-500' },
  amber: { border: 'border-l-amber-400', iconBg: 'bg-gradient-to-br from-amber-500/10 to-amber-100/50', iconText: 'text-amber-500' },
};

const StatCard: React.FC<{ title: string, value: number, icon: React.ElementType, accent?: 'brand' | 'emerald' | 'amber' }> = ({ title, value, icon: Icon, accent = 'brand' }) => {
  const t = statCardThemes[accent];
  return (
    <div className={`bg-gradient-to-br from-white to-zinc-50/50 p-4 md:p-8 rounded-2xl md:rounded-[40px] border border-zinc-100 border-l-4 ${t.border} shadow-sm hover:shadow-2xl transition-shadow`}>
      <div className={`flex items-center justify-center w-12 h-12 ${t.iconBg} rounded-2xl ${t.iconText} mb-4`}>
        <Icon size={24} />
      </div>
      <p className="text-sm font-bold text-zinc-400">{title}</p>
      <p className="text-xl md:text-3xl font-black text-zinc-900 mt-1">{value}</p>
    </div>
  );
};

export default CoordinatorView;
