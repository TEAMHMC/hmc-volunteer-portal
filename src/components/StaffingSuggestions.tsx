import React, { useMemo } from 'react';
import { Volunteer } from '../types';
import { X, UserPlus, CheckCircle } from 'lucide-react';

interface StaffingSuggestionsProps {
    role: string;
    eventDate: string;
    allVolunteers: Volunteer[];
    assignedVolunteerIds: string[];
    onClose: () => void;
    onAssign: (volunteerId: string) => void;
}

const StaffingSuggestions: React.FC<StaffingSuggestionsProps> = ({ role, eventDate, allVolunteers, assignedVolunteerIds, onClose, onAssign }) => {
    
    const suggestions = useMemo(() => {
        const eventDay = new Date(eventDate).toLocaleString('en-US', { weekday: 'short' });

        return allVolunteers.filter(v => {
            // Role match
            if (v.role !== role) return false;
            // Already assigned to this shift
            if (assignedVolunteerIds.includes(v.id)) return false;
            // General availability match
            if (!v.availability?.days.some(d => d.startsWith(eventDay))) return false;
            // Check for specific unavailable dates
            if (v.availability?.unavailableDates?.includes(eventDate)) return false;

            return true;
        });
    }, [role, eventDate, allVolunteers, assignedVolunteerIds]);

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[2001] flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white max-w-2xl w-full rounded-2xl shadow-lg flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
                <header className="p-6 border-b border-zinc-100 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold">Staffing Suggestions</h2>
                        <p className="text-sm text-zinc-500">Available volunteers for <span className="font-bold text-black">{role}</span> on {eventDate}</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-700"><X size={20}/></button>
                </header>

                <main className="p-6 overflow-y-auto">
                    {suggestions.length === 0 ? (
                        <p className="text-center text-zinc-500 py-10">No available volunteers match the criteria.</p>
                    ) : (
                        <div className="space-y-3">
                            {suggestions.map(v => (
                                <div key={v.id} className="p-4 bg-zinc-50 rounded-lg flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-zinc-200 flex items-center justify-center font-bold">{v.name.charAt(0)}</div>
                                        <div>
                                            <p className="font-bold text-zinc-800">{v.name}</p>
                                            <p className="text-xs text-zinc-500">{v.hoursContributed} hours contributed</p>
                                        </div>
                                    </div>
                                    <button onClick={() => onAssign(v.id)} className="px-4 py-2 bg-[#233DFF] text-white text-xs font-bold rounded-lg flex items-center gap-2">
                                        <UserPlus size={14} /> Assign
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default StaffingSuggestions;
