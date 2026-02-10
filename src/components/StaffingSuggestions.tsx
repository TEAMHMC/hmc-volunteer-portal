import React, { useMemo, useState } from 'react';
import { Volunteer } from '../types';
import { X, UserPlus, CheckCircle, Search, Star } from 'lucide-react';

interface StaffingSuggestionsProps {
    role: string;
    eventDate: string;
    allVolunteers: Volunteer[];
    assignedVolunteerIds: string[];
    onClose: () => void;
    onAssign: (volunteerId: string) => void;
}

const StaffingSuggestions: React.FC<StaffingSuggestionsProps> = ({ role, eventDate, allVolunteers, assignedVolunteerIds, onClose, onAssign }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [filterMode, setFilterMode] = useState<'recommended' | 'all'>('all');

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

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[2001] flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white max-w-2xl w-full rounded-2xl shadow-lg flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
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
                </main>

                <footer className="p-4 border-t border-zinc-100 text-center">
                    <p className="text-xs text-zinc-400">{displayList.length} volunteer{displayList.length !== 1 ? 's' : ''} shown · {assignedVolunteerIds.length} already assigned</p>
                </footer>
            </div>
        </div>
    );
};

export default StaffingSuggestions;
