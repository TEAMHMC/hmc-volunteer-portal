
import React, { useState, useEffect } from 'react';
import { Opportunity, ClientRecord } from '../types';
import { apiService } from '../services/apiService';
import { APP_CONFIG } from '../config';
import { Calendar, CheckCircle, Loader2, MapPin, X } from 'lucide-react';

interface ClientPortalProps {
  onBackToLanding: () => void;
}

const ClientPortal: React.FC<ClientPortalProps> = ({ onBackToLanding }) => {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null);
  
  // Helper to check if event is in the past
  const isPastEvent = (dateStr: string) => {
    const eventDate = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return eventDate < today;
  };

  useEffect(() => {
    const fetchPublicOpps = async () => {
      try {
        const publicOpps = await apiService.get('/public/opportunities');
        // Filter out past events
        const upcomingOpps = publicOpps.filter((o: Opportunity) => !isPastEvent(o.date));
        setOpportunities(upcomingOpps);
      } catch (error) {
        console.error("Failed to load public events:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchPublicOpps();
  }, []);

  return (
    <div className="min-h-screen bg-zinc-50 font-['Inter']">
      <nav className="max-w-[1200px] mx-auto w-full px-6 py-8 flex justify-between items-center">
        <div className="flex items-center gap-4 cursor-pointer" onClick={onBackToLanding}>
          <img src={APP_CONFIG.BRAND.logoUrl} alt="HMC" className="w-10 h-10" />
          <span className="text-xs font-black text-zinc-900 uppercase tracking-widest">Health Matters Clinic</span>
        </div>
        <button onClick={onBackToLanding} className="text-xs font-bold text-zinc-500 hover:text-zinc-900">Return to Home</button>
      </nav>

      <main className="max-w-[1200px] mx-auto w-full px-6 py-16">
        <div className="text-center max-w-2xl mx-auto">
          <h1 className="text-5xl font-black text-zinc-900 tracking-tighter">Community Events</h1>
          <p className="text-lg text-zinc-500 mt-4">Find and RSVP for upcoming workshops, health fairs, and wellness events near you.</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-500" size={32}/></div>
        ) : (
          <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {opportunities.map(opp => (
              <div key={opp.id} className="bg-white p-8 rounded-3xl border border-zinc-100 shadow-sm flex flex-col">
                <h3 className="text-xl font-bold text-zinc-800">{opp.title}</h3>
                <p className="text-sm text-zinc-400 font-medium mt-1">{opp.category}</p>
                <div className="flex items-center gap-2 text-xs text-zinc-500 my-4">
                  <Calendar size={14}/> {opp.date}
                </div>
                 <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <MapPin size={14}/> {opp.serviceLocation}
                </div>
                <div className="mt-auto pt-6">
                  <button onClick={() => setSelectedOpp(opp)} className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700">RSVP Now</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {selectedOpp && <RSVPModal opportunity={selectedOpp} onClose={() => setSelectedOpp(null)} />}
    </div>
  );
};


const RSVPModal: React.FC<{ opportunity: Opportunity; onClose: () => void }> = ({ opportunity, onClose }) => {
  const [formData, setFormData] = useState<Partial<Omit<ClientRecord, 'id'>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    try {
      await apiService.post('/public/rsvp', { client: formData, eventId: opportunity.id });
      setIsSuccess(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white max-w-md w-full rounded-2xl shadow-lg p-8" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold">RSVP for {opportunity.title}</h2>
            <p className="text-sm text-zinc-500">{opportunity.date}</p>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-700"><X size={20}/></button>
        </div>

        {isSuccess ? (
          <div className="text-center py-12">
            <CheckCircle className="mx-auto text-emerald-500 mb-4" size={48} />
            <h3 className="font-bold text-lg">You're on the list!</h3>
            <p className="text-zinc-600">We look forward to seeing you at the event.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <input required placeholder="First Name" onChange={e => setFormData(p => ({...p, firstName: e.target.value}))} className="w-full p-3 border rounded-lg"/>
            <input required placeholder="Last Name" onChange={e => setFormData(p => ({...p, lastName: e.target.value}))} className="w-full p-3 border rounded-lg"/>
            <input required type="email" placeholder="Email" onChange={e => setFormData(p => ({...p, email: e.target.value}))} className="w-full p-3 border rounded-lg"/>
            <input required type="tel" placeholder="Phone" onChange={e => setFormData(p => ({...p, phone: e.target.value}))} className="w-full p-3 border rounded-lg"/>
            <input required placeholder="Date of Birth (MM/DD/YYYY)" onChange={e => setFormData(p => ({...p, dob: e.target.value}))} className="w-full p-3 border rounded-lg"/>
            {error && <p className="text-rose-500 text-sm">{error}</p>}
            <button type="submit" disabled={isSubmitting} className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {isSubmitting ? <Loader2 className="animate-spin mx-auto"/> : 'Confirm RSVP'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};


export default ClientPortal;
