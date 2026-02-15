
import React, { useState, useEffect, useCallback } from 'react';
import { toastService } from '../services/toastService';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

const Toast: React.FC = () => {
  const [toasts, setToasts] = useState<{ id: number; message: string; type: 'success' | 'error' | 'info' }[]>([]);

  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev.slice(-4), { id, message, type }]); // keep max 5
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  useEffect(() => {
    toastService.subscribe(addToast);
    return () => toastService.unsubscribe();
  }, [addToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 max-w-sm">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`flex items-center gap-3 px-5 py-4 rounded-2xl shadow-elevation-3 border text-sm font-bold animate-in slide-in-from-right duration-300 ${
            t.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
            t.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' :
            'bg-blue-50 border-blue-200 text-blue-800'
          }`}
        >
          {t.type === 'success' && <CheckCircle size={18} className="shrink-0" />}
          {t.type === 'error' && <XCircle size={18} className="shrink-0" />}
          {t.type === 'info' && <Info size={18} className="shrink-0" />}
          <span className="flex-1">{t.message}</span>
          <button onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))} className="shrink-0 opacity-50 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};

export default Toast;
