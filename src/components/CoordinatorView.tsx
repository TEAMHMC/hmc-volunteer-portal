import React from 'react';
import { Volunteer } from '../types';
import { Users, UserCheck, Calendar, MessageSquare } from 'lucide-react';

interface CoordinatorViewProps {
  user: Volunteer;
  allVolunteers: Volunteer[];
}

const CoordinatorView: React.FC<CoordinatorViewProps> = ({ user, allVolunteers }) => {
  const myTeam = allVolunteers.filter(v => v.managedBy === user.id);
  // These would be calculated from real shift data
  const pendingApprovals = 5;
  const upcomingShifts = 3;

  return (
    <div className="space-y-10 animate-in fade-in">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <StatCard title="My Team" value={myTeam.length} icon={Users} />
        <StatCard title="Pending Approvals" value={pendingApprovals} icon={UserCheck} />
        <StatCard title="Upcoming Missions" value={upcomingShifts} icon={Calendar} />
      </div>

      <div className="bg-white p-12 rounded-[56px] border border-zinc-100 shadow-sm">
        <h3 className="text-2xl font-medium text-zinc-900 tracking-normal mb-8">Team Roster</h3>
        <div className="space-y-4">
          {myTeam.length > 0 ? myTeam.map(v => (
            <div key={v.id} className="p-5 bg-zinc-50 border border-zinc-100 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-zinc-200 flex items-center justify-center font-medium">{v.name.charAt(0)}</div>
                <div>
                  <p className="font-medium text-zinc-800">{v.name}</p>
                  <p className="text-xs text-zinc-500">{v.role}</p>
                </div>
              </div>
              <button className="text-xs font-medium bg-white border border-zinc-200 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-zinc-100">
                <MessageSquare size={14}/> Message
              </button>
            </div>
          )) : <p className="text-zinc-400 italic">You currently do not manage any volunteers.</p>}
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ title: string, value: number, icon: React.ElementType }> = ({ title, value, icon: Icon }) => (
  <div className="bg-white p-8 rounded-[40px] border border-zinc-100 shadow-sm">
    <div className="flex items-center justify-center w-12 h-12 bg-zinc-50 rounded-2xl text-zinc-500 mb-4">
      <Icon size={24} />
    </div>
    <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">{title}</p>
    <p className="text-4xl font-medium text-zinc-900 mt-1">{value}</p>
  </div>
);

export default CoordinatorView;