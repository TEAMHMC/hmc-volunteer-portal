
import React, { useState, useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { I18N } from '../constants';
import { ClinicEvent, Language, Volunteer, Opportunity } from '../types';
import { MapPin, Search, Calendar, Clock, Share2, CheckCircle2, Navigation } from 'lucide-react';

const PROGRAM_COLORS: { [key: string]: string } = {
  'Unstoppable Workshop': '#4f46e5',
  'Unstoppable Wellness Meetup': '#7c3aed',
  'Community Walk & Run': '#059669',
  'Health Fair': '#ea580c',
  'Wellness': '#db2777',
  'Community Outreach': '#0891b2',
  'Street Medicine': '#be123c',
  'default': '#4b5563'
};

const createIcon = (color: string) => {
  return L.divIcon({
    className: 'custom-icon',
    html: `
      <div style="background-color: ${color};" class="w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
      </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
};

const MapController = ({ event }: { event: ClinicEvent | null }) => {
  const map = useMap();
  useEffect(() => {
    if (event) {
      map.flyTo([event.lat, event.lng], 13);
    }
  }, [event, map]);
  return null;
};

// Helper to convert Opportunity to ClinicEvent for map display
const mapOpportunityToEvent = (opp: Opportunity): ClinicEvent => {
    // Default to approximate LA coordinates if missing, scattered slightly to avoid overlap
    const defaultLat = 34.0522 + (Math.random() - 0.5) * 0.1;
    const defaultLng = -118.2437 + (Math.random() - 0.5) * 0.1;

    return {
        id: opp.id,
        title: opp.title,
        program: opp.category,
        lat: opp.locationCoordinates?.lat || defaultLat,
        lng: opp.locationCoordinates?.lng || defaultLng,
        address: opp.serviceLocation,
        city: 'Los Angeles', // Default, assumes LA based
        dateDisplay: new Date(opp.date).toLocaleDateString(),
        time: '9:00 AM - 3:00 PM', // Default/Placeholder as Opportunity object date is just YYYY-MM-DD
        surveyKitId: opp.surveyKitId
    };
}

const EventExplorer: React.FC<{ user: Volunteer; opportunities: Opportunity[]; onUpdate: (u: Volunteer) => void }> = ({ user, opportunities, onUpdate }) => {
  const [lang, setLang] = useState<Language>('en');
  const [selectedEvent, setSelectedEvent] = useState<ClinicEvent | null>(null);
  const [search, setSearch] = useState('');
  const t = I18N[lang];

  // Convert live opportunities to map events
  const events = useMemo(() => opportunities.map(mapOpportunityToEvent), [opportunities]);

  const filtered = useMemo(() => {
    return events.filter(e => 
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      e.address.toLowerCase().includes(search.toLowerCase())
    );
  }, [search, events]);

  const handleSignUp = (eventId: string) => {
    const alreadySignedUp = user.rsvpedEventIds?.includes(eventId);
    const updatedIds = alreadySignedUp 
      ? user.rsvpedEventIds?.filter(id => id !== eventId)
      : [...(user.rsvpedEventIds || []), eventId];
    
    onUpdate({ ...user, rsvpedEventIds: updatedIds });
  };

  return (
    <div className="h-full flex flex-col gap-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Community Events</h2>
          <p className="text-slate-500 text-lg font-light">Find and sign up for upcoming volunteer opportunities.</p>
        </div>
        <div className="flex bg-white border border-slate-200 rounded-2xl overflow-hidden h-12 shadow-sm">
          <button onClick={() => setLang('en')} className={`px-5 py-2 text-[10px] font-black tracking-widest transition-all ${lang === 'en' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-50'}`}>EN</button>
          <button onClick={() => setLang('es')} className={`px-5 py-2 text-[10px] font-black tracking-widest transition-all ${lang === 'es' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-50'}`}>ES</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 flex-1 min-h-0">
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="relative group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
            <input 
              type="text" 
              placeholder="Search by location or event..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-[28px] py-6 pl-16 pr-8 text-lg font-medium outline-none focus:ring-8 focus:ring-indigo-500/5 transition-all shadow-sm"
            />
          </div>

          <div className="bg-slate-200 rounded-[48px] overflow-hidden relative shadow-inner border-4 border-white flex-1 min-h-[400px]">
            <MapContainer center={[34.0522, -118.2437]} zoom={10} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {filtered.map(e => (
                <Marker 
                  key={e.id} 
                  position={[e.lat, e.lng]} 
                  icon={createIcon(PROGRAM_COLORS[e.program] || PROGRAM_COLORS['default'])}
                  eventHandlers={{
                    click: () => setSelectedEvent(e),
                  }}
                >
                  <Popup>
                    <p className="font-bold">{e.title}</p>
                    <p>{e.address}</p>
                  </Popup>
                </Marker>
              ))}
              <MapController event={selectedEvent} />
            </MapContainer>

            <div className="absolute bottom-8 right-8 flex flex-col gap-3 z-[1000]">
               <div className="bg-white/80 backdrop-blur-md p-4 rounded-3xl shadow-xl border border-white">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Legend</p>
                  <div className="flex flex-col gap-2">
                    {Object.entries(PROGRAM_COLORS).filter(([k]) => k !== 'default').map(([name, color]) => (
                      <div key={name} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-[10px] font-bold text-slate-600">{name}</span>
                      </div>
                    ))}
                  </div>
               </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 flex flex-col gap-6 h-full overflow-y-auto no-scrollbar">
          {selectedEvent ? (
            <div className="bg-white rounded-[48px] p-10 border border-slate-100 shadow-xl flex flex-col gap-8 animate-in slide-in-from-right-10 shrink-0">
              <div className="flex justify-between items-start">
                 <span className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest text-white shadow-lg" style={{ backgroundColor: PROGRAM_COLORS[selectedEvent.program] || PROGRAM_COLORS['default'] }}>
                   {selectedEvent.program}
                 </span>
                 <button onClick={() => setSelectedEvent(null)} className="text-slate-300 hover:text-slate-600"><Share2 size={24} /></button>
              </div>

              <div>
                <h3 className="text-3xl font-black text-slate-900 leading-tight mb-4">{selectedEvent.title}</h3>
                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] flex items-center gap-2">
                  <MapPin size={14} /> {selectedEvent.address}, {selectedEvent.city}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-100">
                  <Calendar className="text-indigo-600 mb-2" size={20} />
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</p>
                  <p className="text-sm font-black text-slate-900">{selectedEvent.dateDisplay}</p>
                </div>
                <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-100">
                  <Clock className="text-indigo-600 mb-2" size={20} />
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Time</p>
                  <p className="text-sm font-black text-slate-900">{selectedEvent.time}</p>
                </div>
              </div>

              <div className="space-y-4">
                <button 
                  onClick={() => handleSignUp(selectedEvent.id)}
                  className={`w-full py-6 rounded-3xl font-black text-lg transition-all shadow-xl flex items-center justify-center gap-3 ${
                    user.rsvpedEventIds?.includes(selectedEvent.id) 
                      ? 'bg-emerald-100 text-emerald-700 shadow-emerald-100' 
                      : 'bg-indigo-600 text-white shadow-indigo-100 hover:bg-indigo-700'
                  }`}
                >
                  {user.rsvpedEventIds?.includes(selectedEvent.id) ? (
                    <><CheckCircle2 size={24} /> Signed Up</>
                  ) : (
                    <>{t.submit_btn}</>
                  )}
                </button>
                <p className="text-center text-[10px] text-slate-400 font-medium">Earn impact points for participating in community events.</p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-[48px] p-10 border border-slate-100 shadow-sm flex-1 flex flex-col items-center justify-center text-center opacity-60">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-6">
                <Navigation size={40} />
              </div>
              <h3 className="text-xl font-black text-slate-400 mb-2 uppercase tracking-widest">Select an Event</h3>
              <p className="text-slate-400 text-sm font-medium">Click a marker on the map to view details and sign up.</p>
            </div>
          )}
          
          <div className="bg-indigo-900 rounded-[48px] p-10 text-white shadow-2xl relative overflow-hidden group shrink-0">
             <Calendar className="absolute -bottom-10 -right-10 w-48 h-48 text-white/5 rotate-12 group-hover:scale-110 transition-transform" />
             <div className="relative z-10">
                <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-6">My Confirmed Events</h4>
                <div className="space-y-4">
                  {user.rsvpedEventIds?.length ? user.rsvpedEventIds.map(id => {
                    const event = events.find(e => e.id === id);
                    if (!event) return null;
                    return (
                      <div key={id} className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10">
                        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white"><CheckCircle2 size={20} /></div>
                        <div>
                          <p className="text-sm font-black">{event.title}</p>
                          <p className="text-[10px] font-bold text-indigo-300 uppercase">{event.dateDisplay}</p>
                        </div>
                      </div>
                    );
                  }) : <p className="text-indigo-300 text-xs font-medium">You haven't signed up for any events yet.</p>}
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventExplorer;
