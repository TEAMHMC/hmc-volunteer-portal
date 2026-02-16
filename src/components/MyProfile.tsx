

import React, { useState, useRef, useEffect } from 'react';
import { Volunteer, Task } from '../types';
import {
  Save, Edit3, Mail, Phone, Calendar, Globe, Clock, Smartphone, Bell, Zap, ClipboardList, Check, TrendingUp, Award, CheckCircle2, Star, Camera, Upload, Shield, XCircle, Plus, Trash2
} from 'lucide-react';
import { toastService } from '../services/toastService';

const formatPhoneNumber = (value: string) => value.replace(/\D/g, '').slice(0, 10).replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');

const MyProfile: React.FC<{ currentUser: Volunteer; onUpdate: (u: Volunteer) => void }> = ({ currentUser, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [profileData, setProfileData] = useState({
    ...currentUser,
    availDays: currentUser.availability?.days || [],
    preferredTime: currentUser.availability?.preferredTime || 'Morning',
    dayTimeSlots: currentUser.availability?.dayTimeSlots || {} as Record<string, { start: string; end: string }>,
    timezone: currentUser.availability?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    startDate: currentUser.availability?.startDate || currentUser.joinedDate,
    unavailableDates: currentUser.availability?.unavailableDates || [],
    notificationPrefs: currentUser.notificationPrefs || {
      emailAlerts: true,
      smsAlerts: false,
      opportunityUpdates: true,
      announcements: true
    },
    tasks: currentUser.tasks || [],
  });

  const [newUnavailableDate, setNewUnavailableDate] = useState('');

  useEffect(() => {
    setProfileData({
      ...currentUser,
      availDays: currentUser.availability?.days || [],
      preferredTime: currentUser.availability?.preferredTime || 'Morning',
      dayTimeSlots: currentUser.availability?.dayTimeSlots || {} as Record<string, { start: string; end: string }>,
      timezone: currentUser.availability?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      startDate: currentUser.availability?.startDate || currentUser.joinedDate,
      unavailableDates: currentUser.availability?.unavailableDates || [],
      notificationPrefs: currentUser.notificationPrefs || {
        emailAlerts: true,
        smsAlerts: false,
        opportunityUpdates: true,
        announcements: true
      },
      tasks: currentUser.tasks || [],
    });
  }, [currentUser]);


  const handleSaveProfile = () => {
    const updatedUser: Volunteer = {
      ...currentUser,
      name: profileData.name,
      email: profileData.email,
      phone: profileData.phone,
      notificationPrefs: profileData.notificationPrefs,
      availability: {
        ...currentUser.availability,
        days: profileData.availDays,
        preferredTime: profileData.preferredTime,
        dayTimeSlots: profileData.dayTimeSlots,
        timezone: profileData.timezone,
        startDate: profileData.startDate,
        unavailableDates: profileData.unavailableDates,
        lastUpdated: new Date().toISOString(),
      },
      tasks: profileData.tasks,
    };
    onUpdate(updatedUser);
    setIsEditing(false);
    setShowReminderBanner(false);
    toastService.success("Profile updated. Your changes have been saved.");
  };

  const handleTaskStatusChange = (taskId: string) => {
    const updatedTasks = profileData.tasks.map(task => {
      if (task.id === taskId) {
        const newStatus: 'pending' | 'completed' = task.status === 'completed' ? 'pending' : 'completed';
        return { ...task, status: newStatus };
      }
      return task;
    });
    const updatedUser = { ...currentUser, tasks: updatedTasks };
    setProfileData(prev => ({...prev, tasks: updatedTasks}));
    onUpdate(updatedUser);
  };
  
  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      onUpdate({ ...currentUser, avatarUrl: base64 });
    };
    reader.readAsDataURL(file);
  };

  const toggleDay = (day: string) => {
    setProfileData(prev => {
      const isRemoving = prev.availDays.includes(day);
      const newDays = isRemoving ? prev.availDays.filter(d => d !== day) : [...prev.availDays, day];
      const newSlots = { ...prev.dayTimeSlots };
      if (isRemoving) {
        delete newSlots[day];
      } else if (!newSlots[day]) {
        newSlots[day] = { start: '09:00', end: '17:00' };
      }
      return { ...prev, availDays: newDays, dayTimeSlots: newSlots };
    });
  };

  const updateDayTime = (day: string, field: 'start' | 'end', value: string) => {
    setProfileData(prev => ({
      ...prev,
      dayTimeSlots: { ...prev.dayTimeSlots, [day]: { ...prev.dayTimeSlots[day], [field]: value } }
    }));
  };

  const addUnavailableDate = () => {
      if (newUnavailableDate && !profileData.unavailableDates.includes(newUnavailableDate)) {
          setProfileData(prev => ({
              ...prev,
              unavailableDates: [...prev.unavailableDates, newUnavailableDate].sort()
          }));
          setNewUnavailableDate('');
      }
  };

  const removeUnavailableDate = (dateToRemove: string) => {
      setProfileData(prev => ({
          ...prev,
          unavailableDates: prev.unavailableDates.filter(d => d !== dateToRemove)
      }));
  };
  
  const handleNotificationChange = (pref: string, value: boolean) => {
      setProfileData(prev => ({
          ...prev,
          notificationPrefs: {
              ...prev.notificationPrefs,
              [pref]: value
          }
      }))
  }

  // Weekly availability reminder
  const [showReminderBanner, setShowReminderBanner] = useState(() => {
    const lastUpdated = currentUser.availability?.lastUpdated;
    if (!lastUpdated) return true;
    const daysSinceUpdate = Math.floor((Date.now() - new Date(lastUpdated).getTime()) / (1000 * 60 * 60 * 24));
    return daysSinceUpdate >= 7;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      {/* Weekly Availability Reminder Banner */}
      {showReminderBanner && (
        <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl flex items-center justify-between animate-in slide-in-from-top">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600">
              <Bell size={24} />
            </div>
            <div>
              <h4 className="text-sm font-black text-amber-900">Weekly Availability Reminder</h4>
              <p className="text-xs text-amber-700">It's been a while since you updated your availability. Keep your schedule current so we can reach you!</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setIsEditing(true); setShowReminderBanner(false); }}
              className="px-4 py-2 bg-amber-600 text-white rounded-full font-bold text-xs hover:bg-amber-700 transition-colors"
            >
              Update Now
            </button>
            <button
              onClick={() => setShowReminderBanner(false)}
              className="p-2 text-amber-400 hover:text-amber-600"
            >
              <XCircle size={20} />
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-8">
          <div className="relative group">
            <div className="w-32 h-32 rounded-2xl bg-brand border-2 border-white shadow-elevation-3 overflow-hidden flex items-center justify-center text-white text-2xl font-black">
              {currentUser.avatarUrl ? <img src={currentUser.avatarUrl} className="w-full h-full object-cover" /> : currentUser.name.charAt(0)}
            </div>
            <button onClick={() => fileInputRef.current?.click()} className="absolute -bottom-2 -right-2 w-12 h-12 bg-white border border-black rounded-full flex items-center justify-center shadow-elevation-2 hover:scale-110 active:scale-95 transition-all"><Camera size={20} /></button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </div>
          <div>
            {isEditing ? (
              <input
                type="text"
                value={profileData.name}
                onChange={e => setProfileData({...profileData, name: e.target.value})}
                className="text-2xl font-black text-zinc-900 tracking-tight bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-2 outline-none focus:bg-white transition-all w-full max-w-md"
                placeholder="Your Name"
              />
            ) : (
              <h2 className="text-2xl font-black text-zinc-900 tracking-tight">{currentUser.name}</h2>
            )}
            <p className="text-zinc-500 mt-2 font-bold flex items-center gap-2"><Shield size={16} className="text-brand" /> {currentUser.role}</p>
          </div>
        </div>
        <button onClick={() => isEditing ? handleSaveProfile() : setIsEditing(true)} className={`px-8 py-4 rounded-full font-black text-[11px] uppercase tracking-widest transition-all flex items-center gap-3 border border-black shadow-elevation-2 ${isEditing ? 'bg-brand text-white' : 'bg-white text-zinc-900 hover:bg-zinc-50'}`}>
          {isEditing ? <><Save size={16}/> Save Profile</> : <><Edit3 size={16}/> Edit Profile</>}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-10">
          <div className="bg-white p-8 rounded-2xl border border-zinc-100 shadow-elevation-1">
             <h3 className="text-2xl font-black text-zinc-900 tracking-tight mb-8 uppercase">Profile Details</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-4">
                   <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-2">Contact</label>
                   {isEditing ? (
                     <div className="space-y-4">
                       <input type="email" value={profileData.email} onChange={e => setProfileData({...profileData, email: e.target.value})} className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl px-6 py-4 font-bold text-sm outline-none focus:bg-white transition-all" placeholder="Email" />
                       <input type="tel" value={profileData.phone} onChange={e => setProfileData({...profileData, phone: formatPhoneNumber(e.target.value)})} className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl px-6 py-4 font-bold text-sm outline-none focus:bg-white transition-all" placeholder="Phone" />
                     </div>
                   ) : (
                     <div className="space-y-4">
                       <p className="text-sm font-bold text-zinc-700 flex items-center gap-3"><Mail size={16} className="text-zinc-300"/> {profileData.email}</p>
                       <p className="text-sm font-bold text-zinc-700 flex items-center gap-3"><Phone size={16} className="text-zinc-300"/> {profileData.phone || 'N/A'}</p>
                     </div>
                   )}
                </div>
                 <div className="space-y-4">
                   <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-2">Notifications</label>
                    {isEditing ? (
                        <div className="space-y-3 p-4 bg-zinc-50 rounded-2xl">
                            <label className="flex items-center gap-3"><input type="checkbox" checked={profileData.notificationPrefs.emailAlerts} onChange={e => handleNotificationChange('emailAlerts', e.target.checked)} /> Email Alerts</label>
                            <label className="flex items-center gap-3"><input type="checkbox" checked={profileData.notificationPrefs.smsAlerts} onChange={e => handleNotificationChange('smsAlerts', e.target.checked)} /> SMS Alerts</label>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <p className="text-sm font-bold text-zinc-700 flex items-center gap-3">{profileData.notificationPrefs.emailAlerts ? <Check size={16} className="text-emerald-500"/> : <XCircle size={16} className="text-rose-500"/>} Email Alerts</p>
                            <p className="text-sm font-bold text-zinc-700 flex items-center gap-3">{profileData.notificationPrefs.smsAlerts ? <Check size={16} className="text-emerald-500"/> : <XCircle size={16} className="text-rose-500"/>} SMS Alerts</p>
                        </div>
                    )}
                </div>
             </div>
          </div>
          <div className="bg-white p-8 rounded-2xl border border-zinc-100 shadow-elevation-1">
            <h3 className="text-2xl font-black text-zinc-900 tracking-tight mb-8 uppercase">Availability</h3>
            {isEditing ? (
                 <div className="space-y-6">
                    <div>
                        <label className="text-sm font-bold text-zinc-600 mb-3 block">Available Days & Hours</label>
                        <div className="grid grid-cols-4 sm:grid-cols-7 gap-3 mb-4">
                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <button key={day} type="button" onClick={() => toggleDay(day)} className={`py-4 rounded-xl text-[10px] font-black border transition-all ${profileData.availDays?.includes(day) ? 'bg-brand text-white border-brand' : 'bg-white border-zinc-200'}`}>{day}</button>)}
                        </div>
                        {profileData.availDays.length > 0 && (
                          <div className="space-y-3">
                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].filter(d => profileData.availDays.includes(d)).map(day => (
                              <div key={day} className="flex items-center gap-3 bg-zinc-50 p-3 rounded-xl border border-zinc-100">
                                <span className="text-xs font-black text-zinc-700 w-10 shrink-0">{day}</span>
                                <input type="time" value={profileData.dayTimeSlots[day]?.start || '09:00'} onChange={e => updateDayTime(day, 'start', e.target.value)} className="bg-white border border-zinc-200 rounded-lg px-3 py-2 text-sm font-bold text-zinc-700 w-32" />
                                <span className="text-xs text-zinc-400 font-bold">to</span>
                                <input type="time" value={profileData.dayTimeSlots[day]?.end || '17:00'} onChange={e => updateDayTime(day, 'end', e.target.value)} className="bg-white border border-zinc-200 rounded-lg px-3 py-2 text-sm font-bold text-zinc-700 w-32" />
                              </div>
                            ))}
                          </div>
                        )}
                    </div>
                    <div>
                        <label className="text-sm font-bold text-zinc-600 mb-3 block">Timezone</label>
                        <select value={profileData.timezone} onChange={e => setProfileData(prev => ({ ...prev, timezone: e.target.value }))} className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 text-sm font-bold text-zinc-700">
                          <option value="America/Los_Angeles">Pacific (Los Angeles)</option>
                          <option value="America/Denver">Mountain (Denver)</option>
                          <option value="America/Chicago">Central (Chicago)</option>
                          <option value="America/New_York">Eastern (New York)</option>
                          <option value="America/Anchorage">Alaska</option>
                          <option value="Pacific/Honolulu">Hawaii</option>
                        </select>
                    </div>
                     <div>
                        <label className="text-sm font-bold text-zinc-600 mb-3 block">Time Off / Unavailable Dates</label>
                         <div className="flex gap-2">
                            <input type="date" value={newUnavailableDate} onChange={e => setNewUnavailableDate(e.target.value)} className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-2" />
                            <button onClick={addUnavailableDate} className="px-4 py-2 bg-zinc-800 text-white rounded-xl text-sm font-bold"><Plus size={16}/></button>
                         </div>
                         <div className="flex flex-wrap gap-2 mt-4">
                             {profileData.unavailableDates.map(date => (
                                 <span key={date} className="flex items-center gap-2 bg-zinc-100 text-zinc-700 text-xs font-bold px-3 py-1 rounded-full">{date} <button onClick={() => removeUnavailableDate(date)}><Trash2 size={12} /></button></span>
                             ))}
                         </div>
                    </div>
                </div>
            ) : (
                 <div className="space-y-6">
                    <div>
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-2 mb-3 block">Weekly Schedule</label>
                        {profileData.availDays.length > 0 ? (
                          <div className="space-y-2">
                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].filter(d => profileData.availDays.includes(d)).map(day => {
                              const slot = profileData.dayTimeSlots[day];
                              const formatTime = (t: string) => {
                                if (!t) return '';
                                const [h, m] = t.split(':');
                                const hour = parseInt(h);
                                const ampm = hour >= 12 ? 'PM' : 'AM';
                                const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                                return `${h12}:${m} ${ampm}`;
                              };
                              return (
                                <div key={day} className="flex items-center gap-4 p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                                  <span className="text-xs font-black text-zinc-900 w-10">{day}</span>
                                  <span className="text-sm font-bold text-zinc-600 flex items-center gap-1.5">
                                    <Clock size={12} className="text-zinc-400" />
                                    {slot ? `${formatTime(slot.start)} – ${formatTime(slot.end)}` : 'All day'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-zinc-400 italic">No days selected.</p>
                        )}
                        {profileData.timezone && (
                          <p className="text-[10px] text-zinc-400 font-bold mt-3 flex items-center gap-1.5"><Globe size={12} /> {profileData.timezone.replace('_', ' ')}</p>
                        )}
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-2 mb-2 block">Upcoming Time Off</label>
                        <div className="flex flex-wrap gap-2">
                            {profileData.unavailableDates.length > 0 ? profileData.unavailableDates.map(date => <span key={date} className="px-3 py-1 bg-zinc-100 text-zinc-700 rounded-full font-bold text-xs">{date}</span>) : <p className="text-xs text-zinc-400 italic">No dates specified.</p>}
                        </div>
                    </div>
                 </div>
            )}
          </div>
        </div>

        <div className="space-y-10">
          <div className="bg-white p-8 rounded-2xl border border-zinc-100 shadow-elevation-1 space-y-10">
            <h3 className="text-2xl font-black text-zinc-900 tracking-tight uppercase">Legacy Badges</h3>
            <div className="grid grid-cols-1 gap-4">
              {currentUser.achievements.length === 0 ? <p className="text-zinc-400 text-sm font-bold italic">No badges earned yet.</p> : currentUser.achievements.map(ach => (
                <div key={ach.id} className="flex items-center gap-5 p-5 bg-zinc-50 rounded-2xl border border-zinc-100/50">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-amber-400 shadow-elevation-1"><Star size={24} fill="currentColor"/></div>
                  <div>
                    <p className="text-sm font-black text-zinc-900">{ach.title}</p>
                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">{new Date(ach.dateEarned).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyProfile;
