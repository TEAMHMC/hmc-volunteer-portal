import React, { useState, useEffect } from 'react';
import { Volunteer } from '../types';
import { Users, UserCheck, Calendar, MessageSquare } from 'lucide-react';
import { apiService } from '../services/apiService';

interface CoordinatorViewProps {
  user: Volunteer;
  allVolunteers: Volunteer[];
}

const CoordinatorView: React.FC<CoordinatorViewProps> = ({ user, allVolunteers }) => {
  const myTeam = allVolunteers.filter(v => v.managedBy === user.id);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [upcomingShifts, setUpcomingShifts] = useState(0);

  useEffect(() => {
    // Count volunteers managed by this user that are still onboarding/applicant
    const pending = myTeam.filter(v => v.status === 'onboarding' || v.status === 'applicant').length;
    setPendingApprovals(pending);

    // Fetch upcoming shifts assigned to team members
    const teamIds = myTeam.map(v => v.id);
    const teamShiftCount = myTeam.reduce((count, v) => count + (v.assignedShiftIds?.length || 0), 0);
    setUpcomingShifts(teamShiftCount);
  }, [allVolunteers, user.id]);

  return (
    <div className="space-y-10 animate-in fade-in">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <StatCard title="My Team" value={myTeam.length} icon={Users} accent="brand" />
        <StatCard title="Pending Approvals" value={pendingApprovals} icon={UserCheck} accent="emerald" />
        <StatCard title="Upcoming Missions" value={upcomingShifts} icon={Calendar} accent="amber" />
      </div>

      <div className="bg-white p-12 rounded-container border border-zinc-100 shadow-elevation-1">
        <h3 className="text-2xl font-black text-zinc-900 tracking-tight uppercase mb-8">Team Roster</h3>
        <div className="space-y-4">
          {myTeam.length > 0 ? myTeam.map(v => (
            <div key={v.id} className="p-5 bg-zinc-50 border border-zinc-100 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-zinc-200 flex items-center justify-center font-bold">{v.name.charAt(0)}</div>
                <div>
                  <p className="font-bold text-zinc-800">{v.name}</p>
                  <p className="text-xs text-zinc-500">{v.role}</p>
                </div>
              </div>
              <button className="text-xs font-bold bg-white border border-zinc-200 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-zinc-100">
                <MessageSquare size={14}/> Message
              </button>
            </div>
          )) : <p className="text-zinc-400 italic">You currently do not manage any volunteers.</p>}
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
    <div className={`bg-gradient-to-br from-white to-zinc-50/50 p-8 rounded-container border border-zinc-100 border-l-4 ${t.border} shadow-elevation-1 hover:shadow-elevation-2 transition-all`}>
      <div className={`flex items-center justify-center w-12 h-12 ${t.iconBg} rounded-2xl ${t.iconText} mb-4`}>
        <Icon size={24} />
      </div>
      <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">{title}</p>
      <p className="text-3xl font-bold text-zinc-900 mt-1">{value}</p>
    </div>
  );
};

export default CoordinatorView;