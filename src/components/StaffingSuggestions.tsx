import React, { useMemo, useState } from 'react';
import { Volunteer } from '../types';
import { X, UserPlus, CheckCircle, Search, Star, Mail, Loader2, Send } from 'lucide-react';
import { apiService } from '../services/apiService';

interface StaffingSuggestionsProps {
    role: string;
    eventDate: string;
    eventId?: string;
    eventTitle?: string;
    allVolunteers: Volunteer[];
    assignedVolunteerIds: string[];
    onClose: () => void;
    onAssign: (volunteerId: string) => void;
}

const StaffingSuggestions: React.FC<StaffingSuggestionsProps> = ({ role, eventDate, eventId, eventTitle, allVolunteers, assignedVolunteerIds, onClose, onAssign }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [filterMode, setFilterMode] = useState<'recommended' | 'all'>('all');

    // Invite state
    const [inviteName, setInviteName] = useState('');
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteSending, setInviteSending] = useState(false);
    const [inviteResult, setInviteResult] = useState<{ type: 'success' | 'error' | 'exists'; message: string } | null>(null);

    const eventDay = useMemo(() => {
        try { return new Date(eventDate + 'T00:00:00').toLocaleString('en-US', { weekday: 'short' }); }
        catch { return ''; }
    }, [eventDate]);

    const { recommended, others } = useMemo(() => {
        const eligible = allVolunteers.filter(v => {
            if (assignedVolunteerIds.includes(v.id)) return false;
            if (v.status !== 'active') return false;
            if (v.availability?.unavailableDates?.includes(eventDate)) return false;
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                if (!v.name.toLowerCase().includes(q) && !v.email?.toLowerCase().includes(q) && !v.role.toLowerCase().includes(q)) return false;
            }
            return true;
        });

        const rec: Volunteer[] = [];
        const rest: Volunteer[] = [];

        for (const v of eligible) {
            const roleMatch = v.role === role;
            const dayMatch = eventDay && v.availability?.days?.some(d => d.startsWith(eventDay));
            if (roleMatch && dayMatch) rec.push(v);
            else rest.push(v);
        }

        // Sort: role matches first, then by hours contributed
        rest.sort((a, b) => {
            const aRole = a.role === role ? 1 : 0;
            const bRole = b.role === role ? 1 : 0;
            if (bRole !== aRole) return bRole - aRole;
            return (b.hoursContributed || 0) - (a.hoursContributed || 0);
        });

        return { recommended: rec, others: rest };
    }, [role, eventDate, eventDay, allVolunteers, assignedVolunteerIds, searchQuery]);

    const displayList = filterMode === 'recommended' ? recommended : [...recommended, ...others];

    const handleSendInvite = async () => {
        if (!inviteName.trim() || !inviteEmail.trim()) return;
        setInviteSending(true);
        setInviteResult(null);
        try {
            const result = await apiService.post('/api/events/invite-volunteer', {
                name: inviteName.trim(),
                email: inviteEmail.trim(),
                eventId,
                eventTitle,
                eventDate,
            });
            if (result.alreadyRegistered) {
                setInviteResult({ type: 'exists', message: `${result.volunteerName || inviteEmail} already has an account. Use the search above to find and assign them.` });
            } else if (result.emailFailed) {
                setInviteResult({ type: 'error', message: `Invite saved but email could not be sent (${result.emailReason}). You may need to contact them manually.` });
                setInviteName('');
                setInviteEmail('');
            } else {
                setInviteResult({ type: 'success', message: `Invite sent to ${inviteEmail}!` });
                setInviteName('');
                setInviteEmail('');
            }
        } catch (err: any) {
            setInviteResult({ type: 'error', message: err?.message || 'Failed to send invite.' });
        } finally {
            setInviteSending(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white max-w-2xl w-full rounded-2xl shadow-elevation-2 flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
                <header className="p-6 border-b border-zinc-100 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-bold">Find Volunteer</h2>
                            <p className="text-sm text-zinc-500">Assign a volunteer to <span className="font-bold text-black">{role}</span> on {eventDate}</p>
                        </div>
                        <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-700"><X size={20}/></button>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                            <input
                                type="text"
                                placeholder="Search by name, email, or role..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm outline-none focus:border-[#233DFF]/50"
                            />
                        </div>
                        <div className="flex bg-zinc-100 rounded-lg p-0.5">
                            <button onClick={() => setFilterMode('all')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${filterMode === 'all' ? 'bg-white shadow text-zinc-900' : 'text-zinc-500'}`}>All</button>
                            <button onClick={() => setFilterMode('recommended')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${filterMode === 'recommended' ? 'bg-white shadow text-zinc-900' : 'text-zinc-500'}`}>Recommended</button>
                        </div>
                    </div>
                </header>

                <main className="p-6 overflow-y-auto">
                    {displayList.length === 0 ? (
                        <div className="text-center py-10">
                            <p className="text-zinc-500">{filterMode === 'recommended' ? 'No recommended volunteers found.' : 'No volunteers match your search.'}</p>
                            {filterMode === 'recommended' && <button onClick={() => setFilterMode('all')} className="mt-2 text-sm text-[#233DFF] font-bold">Show all volunteers</button>}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {displayList.map(v => {
                                const isRecommended = recommended.includes(v);
                                const isRoleMatch = v.role === role;
                                return (
                                    <div key={v.id} className={`p-4 rounded-xl flex items-center justify-between ${isRecommended ? 'bg-emerald-50 border border-emerald-200' : 'bg-zinc-50 border border-zinc-100'}`}>
                                        <div className="flex items-center gap-4 min-w-0">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${isRecommended ? 'bg-emerald-200 text-emerald-800' : 'bg-zinc-200 text-zinc-600'}`}>{v.name.charAt(0)}</div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-bold text-zinc-800 truncate">{v.name}</p>
                                                    {isRecommended && <Star size={12} className="text-emerald-600 fill-emerald-600 shrink-0" />}
                                                </div>
                                                <p className="text-xs text-zinc-500">{v.role} · {v.hoursContributed || 0} hrs{isRoleMatch && !isRecommended ? ' · Role match' : ''}</p>
                                            </div>
                                        </div>
                                        <button onClick={() => onAssign(v.id)} className="px-4 py-2 bg-[#233DFF] text-white text-xs font-bold rounded-lg flex items-center gap-2 shrink-0">
                                            <UserPlus size={14} /> Assign
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Invite New Volunteer Section */}
                    <div className="mt-6 pt-6 border-t border-zinc-200">
                        <div className="flex items-center gap-2 mb-3">
                            <Mail size={16} className="text-zinc-400" />
                            <p className="text-sm font-bold text-zinc-700">Don't see who you're looking for?</p>
                        </div>
                        <p className="text-xs text-zinc-400 mb-4">Invite someone who hasn't created a portal account yet. They'll receive an email with a link to register.</p>
                        <div className="flex items-end gap-2">
                            <div className="flex-1">
                                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Name</label>
                                <input
                                    type="text"
                                    value={inviteName}
                                    onChange={e => setInviteName(e.target.value)}
                                    placeholder="Full name"
                                    className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-sm outline-none focus:border-[#233DFF]/50"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Email</label>
                                <input
                                    type="email"
                                    value={inviteEmail}
                                    onChange={e => setInviteEmail(e.target.value)}
                                    placeholder="email@example.com"
                                    className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-sm outline-none focus:border-[#233DFF]/50"
                                />
                            </div>
                            <button
                                onClick={handleSendInvite}
                                disabled={inviteSending || !inviteName.trim() || !inviteEmail.trim()}
                                className="px-4 py-2.5 bg-zinc-900 text-white text-xs font-bold rounded-lg flex items-center gap-2 shrink-0 disabled:opacity-50 hover:bg-zinc-800 transition-colors"
                            >
                                {inviteSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                Send Invite
                            </button>
                        </div>
                        {inviteResult && (
                            <div className={`mt-3 p-3 rounded-lg text-xs font-medium ${
                                inviteResult.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                inviteResult.type === 'exists' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                                {inviteResult.type === 'success' && <CheckCircle size={14} className="inline mr-1.5" />}
                                {inviteResult.message}
                            </div>
                        )}
                    </div>
                </main>

                <footer className="p-4 border-t border-zinc-100 text-center">
                    <p className="text-xs text-zinc-400">{displayList.length} volunteer{displayList.length !== 1 ? 's' : ''} shown · {assignedVolunteerIds.length} already assigned</p>
                </footer>
            </div>
        </div>
    );
};

export default StaffingSuggestions;
