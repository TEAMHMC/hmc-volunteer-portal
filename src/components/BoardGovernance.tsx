import React from 'react';
import { Volunteer } from '../types';
import { BOARD_GOVERNANCE_DOCS } from '../constants';
import {
  Briefcase, FileSignature, FileText, Download, ExternalLink,
  Calendar, Clock, Users, CalendarDays
} from 'lucide-react';

interface BoardGovernanceProps {
  user: Volunteer;
}

const BoardGovernance: React.FC<BoardGovernanceProps> = ({ user }) => {
  const isBoardMember = user.role === 'Board Member';
  const isCAB = user.role === 'Community Advisory Board';

  return (
    <div className="space-y-12 animate-in fade-in duration-700 pb-32">
      {/* Header */}
      <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 p-12 rounded-[56px] text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
        <div className="relative z-10 flex items-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center shadow-lg">
            <Briefcase size={32} />
          </div>
          <div>
            <h2 className="text-4xl font-black tracking-tight">Board Governance Center</h2>
            <p className="text-zinc-400 text-lg mt-2">
              Required forms, policies, and governance documents for {isBoardMember ? 'board' : 'advisory board'} service.
            </p>
          </div>
        </div>
      </div>

      {/* Meeting Schedule */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-[#233DFF]/5 p-10 rounded-[40px] border border-[#233DFF]/10">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-14 h-14 rounded-2xl bg-[#233DFF]/10 flex items-center justify-center">
              <CalendarDays size={28} className="text-[#233DFF]" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-zinc-900">
                {isBoardMember ? 'Board Meetings' : 'CAB Meetings'}
              </h3>
              <p className="text-sm text-zinc-500">
                {BOARD_GOVERNANCE_DOCS.meetingSchedule[isBoardMember ? 'boardMeetings' : 'cabMeetings'].frequency}
              </p>
            </div>
          </div>
          <div className="space-y-5">
            <div className="flex items-start gap-4 p-4 bg-white rounded-2xl">
              <Calendar size={18} className="text-[#233DFF] mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-bold text-zinc-900">Schedule</p>
                <p className="text-sm text-zinc-600">
                  {BOARD_GOVERNANCE_DOCS.meetingSchedule[isBoardMember ? 'boardMeetings' : 'cabMeetings'].schedule}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-4 bg-white rounded-2xl">
              <Clock size={18} className="text-[#233DFF] mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-bold text-zinc-900">Time</p>
                <p className="text-sm text-zinc-600">
                  {BOARD_GOVERNANCE_DOCS.meetingSchedule[isBoardMember ? 'boardMeetings' : 'cabMeetings'].time}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-4 bg-white rounded-2xl">
              <Users size={18} className="text-[#233DFF] mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-bold text-zinc-900">Attendance Target</p>
                <p className="text-sm text-zinc-600">{BOARD_GOVERNANCE_DOCS.meetingSchedule.attendanceExpectation}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-zinc-50 p-10 rounded-[40px] border border-zinc-100">
          <h4 className="text-xl font-black text-zinc-900 mb-6">Standard Meeting Agenda</h4>
          <ol className="space-y-3">
            {BOARD_GOVERNANCE_DOCS.meetingSchedule.standardAgenda.map((item, idx) => (
              <li key={idx} className="flex items-start gap-4">
                <span className="w-8 h-8 rounded-full bg-zinc-200 text-zinc-600 text-sm font-bold flex items-center justify-center shrink-0">
                  {idx + 1}
                </span>
                <span className="text-sm text-zinc-700 pt-1.5">{item}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Required Forms */}
      <div>
        <h3 className="text-2xl font-black text-zinc-900 tracking-tight uppercase mb-8 flex items-center gap-4">
          <FileSignature size={28} className="text-rose-500" /> Required Forms
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {BOARD_GOVERNANCE_DOCS.requiredForms.map(form => (
            <div
              key={form.id}
              className={`p-10 rounded-[40px] border-2 transition-all ${
                form.required ? 'border-rose-200 bg-rose-50/30' : 'border-zinc-100 bg-white'
              }`}
            >
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    form.required ? 'bg-rose-100 text-rose-600' : 'bg-zinc-100 text-zinc-500'
                  }`}>
                    <FileSignature size={24} />
                  </div>
                  {form.required && (
                    <span className="px-3 py-1 bg-rose-100 text-rose-700 rounded-full text-[10px] font-black uppercase tracking-widest">
                      Required
                    </span>
                  )}
                </div>
              </div>
              <h4 className="text-xl font-black text-zinc-900">{form.title}</h4>
              <p className="text-sm text-zinc-500 mt-3 leading-relaxed">{form.description}</p>
              <p className="text-xs font-bold text-zinc-400 mt-4">{form.dueDate}</p>
              <button className="mt-8 w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold text-sm uppercase tracking-widest flex items-center justify-center gap-3 hover:scale-[1.02] transition-transform shadow-lg">
                <Download size={16} /> Download Form
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Governance Documents */}
      <div>
        <h3 className="text-2xl font-black text-zinc-900 tracking-tight uppercase mb-8 flex items-center gap-4">
          <FileText size={28} className="text-[#233DFF]" /> Governance Documents
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {BOARD_GOVERNANCE_DOCS.governanceDocs.map(doc => (
            <div
              key={doc.id}
              className="p-8 rounded-[32px] border border-zinc-100 bg-white hover:shadow-xl hover:border-zinc-200 transition-all group"
            >
              <div className="w-14 h-14 rounded-2xl bg-zinc-50 flex items-center justify-center text-zinc-400 mb-6 group-hover:bg-[#233DFF]/10 group-hover:text-[#233DFF] transition-colors">
                <FileText size={28} />
              </div>
              <h4 className="text-lg font-black text-zinc-900">{doc.title}</h4>
              <p className="text-sm text-zinc-500 mt-3 line-clamp-2 leading-relaxed">{doc.description}</p>
              <button className="mt-6 text-sm font-bold text-[#233DFF] flex items-center gap-2 hover:underline">
                View Document <ExternalLink size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Committee Information */}
      <div className="bg-white p-12 rounded-[56px] border border-zinc-100 shadow-sm">
        <h3 className="text-2xl font-black text-zinc-900 tracking-tight uppercase mb-8">
          Standing Committees
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {BOARD_GOVERNANCE_DOCS.meetingSchedule.committeeMeetings.committees.map((committee, idx) => (
            <div key={idx} className="p-6 bg-zinc-50 rounded-2xl border border-zinc-100">
              <p className="font-bold text-zinc-800">{committee}</p>
              <p className="text-xs text-zinc-400 mt-1">
                {BOARD_GOVERNANCE_DOCS.meetingSchedule.committeeMeetings.frequency}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BoardGovernance;
