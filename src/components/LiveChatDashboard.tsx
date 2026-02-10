import React, { useState, useEffect, useRef } from 'react';
import { User } from '../types';

interface ChatMessage {
  id: string;
  type: 'user' | 'bot' | 'volunteer';
  content: string;
  timestamp: Date | string;
  senderName?: string;
}

interface ChatSession {
  sessionId: string;
  messages: ChatMessage[];
  requestedAt: string;
  status: 'pending' | 'active' | 'closed';
  assignedVolunteer?: string;
  userInfo?: {
    name?: string;
    email?: string;
    phone?: string;
  };
}

interface LiveChatDashboardProps {
  currentUser: User;
}

// Check if current time is within live chat hours (10 AM - 6 PM Pacific)
const isWithinChatHours = (): boolean => {
  const now = new Date();
  // Use Pacific time — this is an LA-based clinic
  const ptFormatter = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: false,
    timeZone: 'America/Los_Angeles'
  });
  const hour = parseInt(ptFormatter.format(now), 10);
  return hour >= 10 && hour < 18; // 10 AM to 6 PM
};

export const LiveChatDashboard: React.FC<LiveChatDashboardProps> = ({ currentUser }) => {
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [view, setView] = useState<'queue' | 'chat'>('queue');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [chatAvailable, setChatAvailable] = useState(isWithinChatHours());

  // Re-check chat hours every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setChatAvailable(isWithinChatHours());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Load chat requests from localStorage (in production, this would be from a WebSocket or API)
  useEffect(() => {
    const loadChatRequests = () => {
      try {
        const requests = JSON.parse(localStorage.getItem('liveChatRequests') || '[]');
        setChatSessions(requests);
      } catch (e) {
        console.error('Failed to load chat requests:', e);
      }
    };

    loadChatRequests();
    // Poll for new requests every 3 seconds
    const interval = setInterval(loadChatRequests, 3000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages]);

  // Focus input when active session changes
  useEffect(() => {
    if (activeSession && view === 'chat') {
      inputRef.current?.focus();
    }
  }, [activeSession, view]);

  const handleClaimSession = (session: ChatSession) => {
    const updatedSession: ChatSession = {
      ...session,
      status: 'active',
      assignedVolunteer: currentUser.name,
      messages: [
        ...session.messages,
        {
          id: `volunteer-join-${Date.now()}`,
          type: 'volunteer',
          content: `Hi! I'm ${currentUser.name}, a volunteer with Health Matters Clinic. How can I help you today?`,
          timestamp: new Date().toISOString(),
          senderName: currentUser.name,
        },
      ],
    };

    // Update localStorage
    const allSessions = JSON.parse(localStorage.getItem('liveChatRequests') || '[]');
    const updatedSessions = allSessions.map((s: ChatSession) =>
      s.sessionId === session.sessionId ? updatedSession : s
    );
    localStorage.setItem('liveChatRequests', JSON.stringify(updatedSessions));

    setActiveSession(updatedSession);
    setChatSessions(updatedSessions);
    setView('chat');
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !activeSession) return;

    const newMessage: ChatMessage = {
      id: `volunteer-${Date.now()}`,
      type: 'volunteer',
      content: messageInput.trim(),
      timestamp: new Date().toISOString(),
      senderName: currentUser.name,
    };

    const updatedSession = {
      ...activeSession,
      messages: [...activeSession.messages, newMessage],
    };

    // Update localStorage
    const allSessions = JSON.parse(localStorage.getItem('liveChatRequests') || '[]');
    const updatedSessions = allSessions.map((s: ChatSession) =>
      s.sessionId === activeSession.sessionId ? updatedSession : s
    );
    localStorage.setItem('liveChatRequests', JSON.stringify(updatedSessions));

    setActiveSession(updatedSession);
    setChatSessions(updatedSessions);
    setMessageInput('');
  };

  const handleCloseSession = () => {
    if (!activeSession) return;

    const closingMessage: ChatMessage = {
      id: `volunteer-close-${Date.now()}`,
      type: 'volunteer',
      content: `Thank you for chatting with us today. If you need anything else, feel free to reach out anytime. Take care! - ${currentUser.name}`,
      timestamp: new Date().toISOString(),
      senderName: currentUser.name,
    };

    const updatedSession = {
      ...activeSession,
      status: 'closed' as const,
      messages: [...activeSession.messages, closingMessage],
    };

    // Update localStorage
    const allSessions = JSON.parse(localStorage.getItem('liveChatRequests') || '[]');
    const updatedSessions = allSessions.map((s: ChatSession) =>
      s.sessionId === activeSession.sessionId ? updatedSession : s
    );
    localStorage.setItem('liveChatRequests', JSON.stringify(updatedSessions));

    setChatSessions(updatedSessions);
    setActiveSession(null);
    setView('queue');
  };

  const pendingSessions = chatSessions.filter((s) => s.status === 'pending');
  const activeSessions = chatSessions.filter((s) => s.status === 'active' && s.assignedVolunteer === currentUser.name);
  const closedSessions = chatSessions.filter((s) => s.status === 'closed');

  const formatTime = (timestamp: Date | string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getTimeAgo = (timestamp: string) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMinutes = Math.floor((now.getTime() - then.getTime()) / 60000);
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Live Chat Support</h2>
          <p className="text-sm text-slate-500 mt-1">
            Help visitors find resources through real-time chat
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setView('queue')}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-all border-2 ${
              view === 'queue'
                ? 'bg-[#233DFF] text-white border-[#233DFF]'
                : 'bg-white text-slate-600 border-slate-200 hover:border-[#233DFF]/40'
            }`}
          >
            Queue ({pendingSessions.length})
          </button>
          <button
            onClick={() => setView('chat')}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-all border-2 ${
              view === 'chat'
                ? 'bg-[#233DFF] text-white border-[#233DFF]'
                : 'bg-white text-slate-600 border-slate-200 hover:border-[#233DFF]/40'
            }`}
          >
            My Chats ({activeSessions.length})
          </button>
        </div>
      </div>

      {/* Offline hours banner */}
      {!chatAvailable && (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-amber-800 mb-2">Live Chat is Currently Offline</h3>
          <p className="text-sm text-amber-600 mb-1">
            Live chat support is available <strong>Monday – Friday, 10:00 AM – 6:00 PM Pacific Time</strong>.
          </p>
          <p className="text-sm text-amber-600">
            For urgent needs, please submit a support ticket or email <strong>support@healthmatters.clinic</strong>.
          </p>
        </div>
      )}

      {/* Queue View */}
      {view === 'queue' && chatAvailable && (
        <div className="grid gap-4">
          {/* Pending Requests */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-yellow-50">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                Waiting for Help ({pendingSessions.length})
              </h3>
            </div>

            {pendingSessions.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <svg className="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="font-medium">No pending chat requests</p>
                <p className="text-sm mt-1">New requests will appear here</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {pendingSessions.map((session) => (
                  <div key={session.sessionId} className="p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="w-8 h-8 rounded-full bg-[#233DFF]/10 text-[#233DFF] flex items-center justify-center text-sm font-semibold">
                            {session.userInfo?.name?.[0] || 'V'}
                          </span>
                          <span className="font-semibold text-slate-900">
                            {session.userInfo?.name || 'Visitor'}
                          </span>
                          <span className="text-xs text-slate-400">
                            {getTimeAgo(session.requestedAt)}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 truncate">
                          {session.messages[session.messages.length - 1]?.content || 'No messages yet'}
                        </p>
                      </div>
                      <button
                        onClick={() => handleClaimSession(session)}
                        className="px-4 py-2 bg-[#233DFF] text-white text-sm font-semibold rounded-full hover:bg-[#1a2fbf] transition-colors border-2 border-black"
                      >
                        Accept Chat
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Sessions (other volunteers) */}
          {activeSessions.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-200 bg-green-50">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full" />
                  Your Active Chats ({activeSessions.length})
                </h3>
              </div>
              <div className="divide-y divide-slate-100">
                {activeSessions.map((session) => (
                  <div
                    key={session.sessionId}
                    className="p-4 hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => {
                      setActiveSession(session);
                      setView('chat');
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-sm font-semibold">
                          {session.userInfo?.name?.[0] || 'V'}
                        </span>
                        <span className="font-semibold text-slate-900">
                          {session.userInfo?.name || 'Visitor'}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">
                        {session.messages.length} messages
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Chat View */}
      {view === 'chat' && chatAvailable && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden h-[600px] flex flex-col">
          {activeSession ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setView('queue')}
                    className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                  >
                    <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      {activeSession.userInfo?.name || 'Visitor'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Started {getTimeAgo(activeSession.requestedAt)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleCloseSession}
                  className="px-4 py-2 bg-slate-200 text-slate-700 text-sm font-semibold rounded-full hover:bg-slate-300 transition-colors"
                >
                  End Chat
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                {activeSession.messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.type === 'volunteer' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[75%] ${
                        message.type === 'volunteer'
                          ? 'bg-[#233DFF] text-white rounded-2xl rounded-br-md'
                          : message.type === 'user'
                          ? 'bg-white border border-slate-200 text-slate-800 rounded-2xl rounded-bl-md shadow-sm'
                          : 'bg-slate-200 text-slate-800 rounded-2xl rounded-bl-md'
                      } px-4 py-3`}
                    >
                      {message.type !== 'volunteer' && message.senderName && (
                        <p className="text-xs font-semibold mb-1 text-[#233DFF]">
                          {message.senderName}
                        </p>
                      )}
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                      <p className={`text-[10px] mt-1 ${message.type === 'volunteer' ? 'text-[#233DFF]/40' : 'text-slate-400'}`}>
                        {formatTime(message.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-200 bg-white">
                <div className="flex items-center gap-3">
                  <input
                    ref={inputRef}
                    type="text"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder="Type your message..."
                    className="flex-1 px-4 py-3 border border-slate-200 rounded-full text-sm focus:outline-none focus:border-[#233DFF]/40 focus:ring-2 focus:ring-[#233DFF]/10"
                  />
                  <button
                    type="submit"
                    disabled={!messageInput.trim()}
                    className="px-6 py-3 bg-[#233DFF] text-white text-sm font-semibold rounded-full hover:bg-[#1a2fbf] disabled:opacity-50 disabled:cursor-not-allowed transition-colors border-2 border-black"
                  >
                    Send
                  </button>
                </div>

                {/* Quick Responses */}
                <div className="flex flex-wrap gap-2 mt-3">
                  {[
                    'Let me look that up for you',
                    'Have you tried calling 211?',
                    'I can connect you with more resources',
                    'Is there anything else I can help with?',
                  ].map((response, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setMessageInput(response)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs rounded-full transition-colors"
                    >
                      {response}
                    </button>
                  ))}
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              <div className="text-center">
                <svg className="w-16 h-16 mx-auto mb-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="font-medium text-lg">No active chat selected</p>
                <p className="text-sm mt-1">Accept a chat from the queue to get started</p>
                <button
                  onClick={() => setView('queue')}
                  className="mt-4 px-6 py-2 bg-[#233DFF] text-white text-sm font-semibold rounded-full hover:bg-[#1a2fbf] transition-colors border-2 border-black"
                >
                  View Queue
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{pendingSessions.length}</p>
              <p className="text-sm text-slate-500">Waiting</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{activeSessions.length}</p>
              <p className="text-sm text-slate-500">Active Chats</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{closedSessions.length}</p>
              <p className="text-sm text-slate-500">Resolved Today</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveChatDashboard;
