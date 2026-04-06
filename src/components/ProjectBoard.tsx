import React, { useState, useEffect, useRef } from 'react';
import { Volunteer, Project, ProjectTask } from '../types';
import { apiService } from '../services/apiService';
import { toastService } from '../services/toastService';
import {
  Plus, X, Calendar, Target, AlertTriangle,
  Loader2, Trash2, ArrowRight, Mail, Save, ChevronDown, Search, User
} from 'lucide-react';

interface ProjectBoardProps {
  user: Volunteer;
  allVolunteers: Volunteer[];
}

const COLUMNS = [
  { id: 'todo', label: 'To Do', dot: 'bg-zinc-400' },
  { id: 'in_progress', label: 'In Progress', dot: 'bg-blue-500' },
  { id: 'review', label: 'Review', dot: 'bg-amber-500' },
  { id: 'done', label: 'Done', dot: 'bg-emerald-500' },
] as const;

const PRIORITY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  urgent: { bg: 'bg-rose-100', text: 'text-rose-600', label: 'Urgent' },
  high: { bg: 'bg-orange-100', text: 'text-orange-600', label: 'High' },
  medium: { bg: 'bg-blue-100', text: 'text-blue-600', label: 'Medium' },
  low: { bg: 'bg-zinc-100', text: 'text-zinc-500', label: 'Low' },
};

// Searchable assignee picker used in both New Task modal and Task Detail modal
const AssigneePicker: React.FC<{
  value: string;
  onChange: (id: string, name: string) => void;
  volunteers: Volunteer[];
  placeholder?: string;
}> = ({ value, onChange, volunteers, placeholder = 'Search name...' }) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const active = volunteers.find(v => v.id === value);
  const filtered = volunteers
    .filter(v => v.status !== 'inactive')
    .filter(v => !query || v.name?.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 20);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between bg-white border-2 border-zinc-200 px-3 py-2.5 rounded-xl text-sm font-medium focus:border-brand outline-none text-left"
      >
        <span className={active ? 'text-zinc-900' : 'text-zinc-400'}>
          {active ? active.name : 'Unassigned'}
        </span>
        <ChevronDown size={14} className="text-zinc-400 shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-zinc-200 rounded-xl shadow-elevation-2 overflow-hidden">
          <div className="p-2 border-b border-zinc-100">
            <div className="flex items-center gap-2 px-2 py-1.5 bg-zinc-50 rounded-lg">
              <Search size={12} className="text-zinc-400 shrink-0" />
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={placeholder}
                className="flex-1 bg-transparent text-xs outline-none text-zinc-700"
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            <button
              type="button"
              onClick={() => { onChange('', ''); setOpen(false); setQuery(''); }}
              className="w-full text-left px-3 py-2 text-xs text-zinc-400 hover:bg-zinc-50 flex items-center gap-2"
            >
              <User size={12} /> Unassigned
            </button>
            {filtered.map(v => (
              <button
                key={v.id}
                type="button"
                onClick={() => { onChange(v.id, v.name || ''); setOpen(false); setQuery(''); }}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-zinc-50 flex items-center gap-2 ${v.id === value ? 'text-brand font-bold' : 'text-zinc-700'}`}
              >
                <div className="w-5 h-5 rounded-full bg-brand text-white flex items-center justify-center text-[9px] font-bold shrink-0">
                  {(v.name || '?').charAt(0)}
                </div>
                {v.name}
                {v.role && <span className="text-zinc-300 text-[10px] ml-auto truncate max-w-[80px]">{v.role}</span>}
              </button>
            ))}
            {filtered.length === 0 && <p className="px-3 py-3 text-xs text-zinc-400 text-center">No matches</p>}
          </div>
        </div>
      )}
    </div>
  );
};

const ProjectBoard: React.FC<ProjectBoardProps> = ({ user, allVolunteers }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewProject, setShowNewProject] = useState(false);
  const [showNewTask, setShowNewTask] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [newProjectDue, setNewProjectDue] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskAssigneeId, setNewTaskAssigneeId] = useState('');
  const [newTaskAssigneeName, setNewTaskAssigneeName] = useState('');
  const [newTaskDue, setNewTaskDue] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [saving, setSaving] = useState(false);

  // Task detail modal
  const [detailTask, setDetailTask] = useState<ProjectTask | null>(null);
  const [detailNotes, setDetailNotes] = useState('');
  const [detailAssigneeId, setDetailAssigneeId] = useState('');
  const [detailAssigneeName, setDetailAssigneeName] = useState('');
  const [detailStatus, setDetailStatus] = useState<ProjectTask['status']>('todo');
  const [detailPriority, setDetailPriority] = useState<ProjectTask['priority']>('medium');
  const [savingDetail, setSavingDetail] = useState(false);

  // Vendor email
  const [showVendorEmail, setShowVendorEmail] = useState(false);
  const [vendorEmail, setVendorEmail] = useState('');
  const [vendorMessage, setVendorMessage] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  const canManage = user.isAdmin || ['Events Lead', 'Events Coordinator', 'Program Coordinator', 'General Operations Coordinator', 'Operations Coordinator', 'Development Coordinator', 'Outreach & Engagement Lead', 'Volunteer Lead'].includes(user.role);

  useEffect(() => { loadProjects(); }, []);
  useEffect(() => { if (selectedProject) loadTasks(selectedProject.id); }, [selectedProject?.id]);

  // Sync detail modal state when task changes
  useEffect(() => {
    if (detailTask) {
      setDetailNotes((detailTask as any).notes || '');
      setDetailAssigneeId(detailTask.assigneeId || '');
      setDetailAssigneeName(detailTask.assigneeName || '');
      setDetailStatus(detailTask.status);
      setDetailPriority(detailTask.priority);
      setShowVendorEmail(false);
      setVendorEmail('');
      setVendorMessage('');
    }
  }, [detailTask?.id]);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const data = await apiService.get('/api/projects');
      setProjects(data.projects || []);
      if (data.projects?.length > 0 && !selectedProject) setSelectedProject(data.projects[0]);
    } catch {
      toastService.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const loadTasks = async (projectId: string) => {
    try {
      const data = await apiService.get(`/api/projects/${projectId}/tasks`);
      setTasks(data.tasks || []);
    } catch {
      setTasks([]);
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectTitle.trim()) return;
    setSaving(true);
    try {
      const result = await apiService.post('/api/projects', {
        title: newProjectTitle, description: newProjectDesc,
        dueDate: newProjectDue || undefined, teamMemberIds: [user.id],
      });
      const newProject = { id: result.id, ...result };
      setProjects(prev => [newProject, ...prev]);
      setSelectedProject(newProject);
      setShowNewProject(false);
      setNewProjectTitle(''); setNewProjectDesc(''); setNewProjectDue('');
      toastService.success('Project created');
    } catch (e: any) {
      toastService.error(e.message);
    } finally { setSaving(false); }
  };

  const handleDeleteProject = async () => {
    if (!selectedProject) return;
    if (!confirm(`Delete project "${selectedProject.title}" and all its tasks? This cannot be undone.`)) return;
    try {
      await apiService.delete(`/api/projects/${selectedProject.id}`);
      const remaining = projects.filter(p => p.id !== selectedProject.id);
      setProjects(remaining);
      setSelectedProject(remaining[0] || null);
      setTasks([]);
      toastService.success('Project deleted');
    } catch (e: any) {
      toastService.error(e.message || 'Failed to delete project');
    }
  };

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim() || !selectedProject) return;
    setSaving(true);
    try {
      const result = await apiService.post(`/api/projects/${selectedProject.id}/tasks`, {
        title: newTaskTitle, description: newTaskDesc,
        assigneeId: newTaskAssigneeId || undefined,
        assigneeName: newTaskAssigneeName || undefined,
        dueDate: newTaskDue || undefined, priority: newTaskPriority,
      });
      setTasks(prev => [...prev, { id: result.id, ...result }]);
      setShowNewTask(false);
      setNewTaskTitle(''); setNewTaskDesc('');
      setNewTaskAssigneeId(''); setNewTaskAssigneeName('');
      setNewTaskDue(''); setNewTaskPriority('medium');
    } catch (e: any) {
      toastService.error(e.message);
    } finally { setSaving(false); }
  };

  const handleMoveTask = async (taskId: string, newStatus: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus as ProjectTask['status'] } : t));
    if (detailTask?.id === taskId) setDetailStatus(newStatus as ProjectTask['status']);
    try {
      await apiService.put(`/api/projects/${selectedProject!.id}/tasks/${taskId}`, { status: newStatus });
    } catch {
      loadTasks(selectedProject!.id);
      toastService.error('Failed to update task');
    }
  };

  const handleDeleteTask = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this task?')) return;
    try {
      await apiService.delete(`/api/projects/${selectedProject!.id}/tasks/${taskId}`);
      setTasks(prev => prev.filter(t => t.id !== taskId));
      if (detailTask?.id === taskId) setDetailTask(null);
    } catch {
      toastService.error('Failed to delete task');
    }
  };

  const handleSaveDetail = async () => {
    if (!detailTask || !selectedProject) return;
    setSavingDetail(true);
    const updates = {
      status: detailStatus,
      priority: detailPriority,
      assigneeId: detailAssigneeId || null,
      assigneeName: detailAssigneeName || null,
      notes: detailNotes,
    };
    try {
      await apiService.put(`/api/projects/${selectedProject.id}/tasks/${detailTask.id}`, updates);
      setTasks(prev => prev.map(t => t.id === detailTask.id ? { ...t, ...updates } : t));
      setDetailTask(prev => prev ? { ...prev, ...updates } : null);
      toastService.success('Task saved');
    } catch {
      toastService.error('Failed to save task');
    } finally { setSavingDetail(false); }
  };

  const handleSendVendorEmail = async () => {
    if (!vendorEmail.trim() || !detailTask || !selectedProject) return;
    setSendingEmail(true);
    try {
      await apiService.post(`/api/projects/${selectedProject.id}/tasks/${detailTask.id}/email-vendor`, {
        toEmail: vendorEmail,
        message: vendorMessage,
        taskTitle: detailTask.title,
        taskDescription: detailTask.description,
        projectTitle: selectedProject.title,
        senderName: user.name,
      });
      toastService.success(`Email sent to ${vendorEmail}`);
      setShowVendorEmail(false);
      setVendorEmail(''); setVendorMessage('');
    } catch {
      toastService.error('Failed to send email');
    } finally { setSendingEmail(false); }
  };

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter(t => t.status === 'done').length;
  const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const overdueTasks = tasks.filter(t => t.dueDate && t.status !== 'done' && t.dueDate < new Date().toISOString().split('T')[0]).length;

  if (loading) {
    return <div className="flex items-center justify-center py-32"><Loader2 size={32} className="animate-spin text-brand" /></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl md:text-5xl font-black tracking-tighter uppercase italic">Projects</h2>
          <p className="text-zinc-500 mt-4 font-medium text-sm md:text-lg">Track campaigns, deadlines, and team progress.</p>
        </div>
        {canManage && (
          <button onClick={() => setShowNewProject(true)} className="px-6 py-3 min-h-[44px] bg-brand text-white border border-black rounded-full font-bold text-sm uppercase tracking-wide flex items-center gap-2 shadow-elevation-2 active:scale-95 shrink-0">
            <Plus size={16} /> New Project
          </button>
        )}
      </div>

      {/* Project tabs */}
      {projects.length > 0 && (
        <div className="flex overflow-x-auto no-scrollbar gap-2 pb-2">
          {projects.map(p => (
            <button key={p.id} onClick={() => setSelectedProject(p)}
              className={`px-4 md:px-6 py-3 rounded-full text-[11px] font-black uppercase tracking-[0.15em] whitespace-nowrap flex items-center gap-2 transition-all min-h-[44px] ${selectedProject?.id === p.id ? 'bg-brand text-white shadow-elevation-2' : 'bg-white text-zinc-400 border border-zinc-100 hover:text-zinc-600'}`}>
              <Target size={14} /> {p.title}
            </button>
          ))}
        </div>
      )}

      {/* Project stats */}
      {selectedProject && (
        <div className="bg-white p-4 md:p-6 rounded-2xl md:rounded-[40px] border border-zinc-100 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="text-lg font-black text-zinc-900">{selectedProject.title}</h3>
              {selectedProject.description && <p className="text-sm text-zinc-500 mt-1">{selectedProject.description}</p>}
            </div>
            <div className="flex items-center gap-3 text-sm flex-wrap">
              {selectedProject.dueDate && (
                <span className="flex items-center gap-1.5 text-zinc-500 font-bold">
                  <Calendar size={14} /> Due {new Date(selectedProject.dueDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              )}
              {overdueTasks > 0 && (
                <span className="flex items-center gap-1.5 text-rose-500 font-bold"><AlertTriangle size={14} /> {overdueTasks} overdue</span>
              )}
              {user.isAdmin && (
                <button onClick={handleDeleteProject} className="flex items-center gap-1.5 text-zinc-300 hover:text-rose-500 font-bold text-xs transition-colors">
                  <Trash2 size={13} /> Delete Project
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1 bg-zinc-100 rounded-full h-3 overflow-hidden">
              <div className="bg-brand h-full rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-sm font-black text-zinc-900">{progress}%</span>
            <span className="text-xs text-zinc-400 font-bold">{doneTasks}/{totalTasks} done</span>
          </div>
        </div>
      )}

      {/* Kanban Board */}
      {selectedProject && (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wide">Board</h3>
            {canManage && (
              <button onClick={() => setShowNewTask(true)} className="px-4 py-2 min-h-[44px] bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-full text-xs font-bold uppercase tracking-wide flex items-center gap-2">
                <Plus size={14} /> Add Task
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {COLUMNS.map(col => {
              const columnTasks = tasks.filter(t => t.status === col.id).sort((a, b) => {
                const order: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
                return (order[a.priority] ?? 2) - (order[b.priority] ?? 2);
              });
              return (
                <div key={col.id} className="bg-zinc-50/50 rounded-2xl p-3 min-h-[200px]">
                  <div className="flex items-center justify-between mb-4 px-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${col.dot}`} />
                      <span className="text-[11px] font-black uppercase tracking-[0.15em] text-zinc-500">{col.label}</span>
                    </div>
                    <span className="text-[11px] font-bold text-zinc-300">{columnTasks.length}</span>
                  </div>
                  <div className="space-y-2">
                    {columnTasks.map(task => {
                      const pStyle = PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.medium;
                      const isOverdue = task.dueDate && task.status !== 'done' && task.dueDate < new Date().toISOString().split('T')[0];
                      const colIdx = COLUMNS.findIndex(c => c.id === col.id);
                      const nextCol = colIdx < COLUMNS.length - 1 ? COLUMNS[colIdx + 1] : null;
                      const hasNotes = !!(task as any).notes;

                      return (
                        <div
                          key={task.id}
                          onClick={() => setDetailTask(task)}
                          className={`bg-white rounded-xl p-3 border shadow-sm hover:shadow-md transition-shadow cursor-pointer ${isOverdue ? 'border-rose-200' : 'border-zinc-100'}`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <p className="text-sm font-bold text-zinc-900 leading-tight flex-1">{task.title}</p>
                            {canManage && (
                              <button onClick={e => handleDeleteTask(task.id, e)} className="p-1 text-zinc-300 hover:text-rose-500 shrink-0">
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                          {task.description && <p className="text-xs text-zinc-400 mb-2 line-clamp-2">{task.description}</p>}
                          <div className="flex items-center gap-1.5 flex-wrap mb-2">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${pStyle.bg} ${pStyle.text}`}>{pStyle.label}</span>
                            {task.labels?.map(label => (
                              <span key={label} className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-brand/10 text-brand">{label}</span>
                            ))}
                            {hasNotes && <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-500">Notes</span>}
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {task.assigneeName && (
                                <div className="w-5 h-5 rounded-full bg-brand text-white flex items-center justify-center text-[10px] font-bold" title={task.assigneeName}>
                                  {task.assigneeName.charAt(0)}
                                </div>
                              )}
                              {task.dueDate && (
                                <span className={`text-[10px] font-bold flex items-center gap-1 ${isOverdue ? 'text-rose-500' : 'text-zinc-400'}`}>
                                  <span className="text-[9px]">📅</span> {new Date(task.dueDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                              )}
                            </div>
                            {nextCol && canManage && (
                              <button
                                onClick={e => handleMoveTask(task.id, nextCol.id, e)}
                                className="p-1.5 rounded-full bg-zinc-100 hover:bg-brand hover:text-white text-zinc-400 transition-colors"
                                title={`Move to ${nextCol.label}`}
                              >
                                <ArrowRight size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Empty state */}
      {projects.length === 0 && !loading && (
        <div className="py-32 text-center bg-zinc-50 rounded-2xl md:rounded-[40px] border border-dashed border-zinc-200">
          <Target className="mx-auto text-zinc-200 mb-6" size={64} strokeWidth={1.5} />
          <p className="text-zinc-400 font-bold text-sm">No projects yet.</p>
          {canManage && <p className="text-sm text-zinc-300 mt-2">Create your first project to start tracking work.</p>}
        </div>
      )}

      {/* ── TASK DETAIL MODAL ── */}
      {detailTask && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={() => setDetailTask(null)}>
          <div className="bg-white rounded-2xl md:rounded-[32px] max-w-lg w-full shadow-elevation-3 border border-zinc-100 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-start justify-between p-5 md:p-6 border-b border-zinc-100 gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${PRIORITY_STYLES[detailTask.priority]?.bg} ${PRIORITY_STYLES[detailTask.priority]?.text}`}>
                    {PRIORITY_STYLES[detailTask.priority]?.label}
                  </span>
                  {detailTask.labels?.map(l => (
                    <span key={l} className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-brand/10 text-brand">{l}</span>
                  ))}
                </div>
                <h3 className="text-lg font-black text-zinc-900 leading-tight">{detailTask.title}</h3>
                {detailTask.createdAt && (
                  <p className="text-xs text-zinc-400 mt-0.5">Added {new Date(detailTask.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                )}
              </div>
              <button onClick={() => setDetailTask(null)} className="p-2 rounded-full hover:bg-zinc-100 shrink-0"><X size={18} /></button>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto flex-1 p-5 md:p-6 space-y-5">
              {/* Description */}
              {detailTask.description && (
                <div>
                  <p className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.15em] mb-1.5">Description</p>
                  <p className="text-sm text-zinc-700 leading-relaxed">{detailTask.description}</p>
                </div>
              )}

              {/* Status + Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black text-zinc-400 uppercase tracking-[0.15em] mb-1.5">Status</label>
                  <select
                    value={detailStatus}
                    onChange={e => setDetailStatus(e.target.value as ProjectTask['status'])}
                    className="w-full bg-white border-2 border-zinc-200 px-3 py-2 rounded-xl text-sm font-medium focus:border-brand outline-none appearance-none"
                  >
                    {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-black text-zinc-400 uppercase tracking-[0.15em] mb-1.5">Priority</label>
                  <select
                    value={detailPriority}
                    onChange={e => setDetailPriority(e.target.value as ProjectTask['priority'])}
                    className="w-full bg-white border-2 border-zinc-200 px-3 py-2 rounded-xl text-sm font-medium focus:border-brand outline-none appearance-none"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              {/* Assignee search */}
              <div>
                <label className="block text-[11px] font-black text-zinc-400 uppercase tracking-[0.15em] mb-1.5">Assigned To</label>
                <AssigneePicker
                  value={detailAssigneeId}
                  onChange={(id, name) => { setDetailAssigneeId(id); setDetailAssigneeName(name); }}
                  volunteers={allVolunteers}
                />
              </div>

              {/* Due date */}
              {detailTask.dueDate && (
                <div>
                  <p className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.15em] mb-1">Due Date</p>
                  <p className="text-sm font-bold text-zinc-700">{new Date(detailTask.dueDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' })}</p>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-[11px] font-black text-zinc-400 uppercase tracking-[0.15em] mb-1.5">Internal Notes</label>
                <textarea
                  value={detailNotes}
                  onChange={e => setDetailNotes(e.target.value)}
                  rows={3}
                  placeholder="Add notes visible to your team..."
                  className="w-full bg-white border-2 border-zinc-200 px-3 py-2.5 rounded-xl text-sm font-medium focus:border-brand outline-none resize-none"
                />
              </div>

              {/* Vendor Email */}
              <div>
                <button
                  onClick={() => setShowVendorEmail(v => !v)}
                  className="flex items-center gap-2 text-xs font-bold text-zinc-500 hover:text-brand transition-colors"
                >
                  <Mail size={13} /> Email External Vendor / Contact
                </button>
                {showVendorEmail && (
                  <div className="mt-3 p-4 bg-zinc-50 rounded-xl border border-zinc-200 space-y-3">
                    <p className="text-xs text-zinc-400">Send this task's details to an outside contact (vendor, partner, contractor).</p>
                    <div>
                      <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em] mb-1">Recipient Email</label>
                      <input
                        type="email"
                        value={vendorEmail}
                        onChange={e => setVendorEmail(e.target.value)}
                        placeholder="vendor@example.com"
                        className="w-full bg-white border-2 border-zinc-200 px-3 py-2 rounded-xl text-sm font-medium focus:border-brand outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em] mb-1">Message / Instructions</label>
                      <textarea
                        value={vendorMessage}
                        onChange={e => setVendorMessage(e.target.value)}
                        rows={3}
                        placeholder="Additional context or instructions for this contact..."
                        className="w-full bg-white border-2 border-zinc-200 px-3 py-2 rounded-xl text-sm font-medium focus:border-brand outline-none resize-none"
                      />
                    </div>
                    <button
                      onClick={handleSendVendorEmail}
                      disabled={sendingEmail || !vendorEmail.trim()}
                      className="w-full py-2 bg-brand text-white border border-black rounded-full font-bold text-xs uppercase tracking-wide flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {sendingEmail ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />} Send Email
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 md:p-5 border-t border-zinc-100 flex gap-3">
              <button onClick={() => setDetailTask(null)} className="flex-1 py-2.5 border-2 border-zinc-200 text-zinc-600 rounded-full font-bold text-sm">
                Close
              </button>
              {canManage && (
                <button
                  onClick={handleSaveDetail}
                  disabled={savingDetail}
                  className="flex-1 py-2.5 bg-brand text-white border border-black rounded-full font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {savingDetail ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Changes
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Project Modal */}
      {showNewProject && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={() => setShowNewProject(false)}>
          <div className="bg-white rounded-2xl md:rounded-[40px] max-w-lg w-full p-6 md:p-8 shadow-elevation-3 border border-zinc-100" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-zinc-900">New Project</h3>
              <button onClick={() => setShowNewProject(false)} className="p-2 rounded-full hover:bg-zinc-100"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2">Project Name *</label>
                <input value={newProjectTitle} onChange={e => setNewProjectTitle(e.target.value)} className="w-full bg-white border-2 border-zinc-200 px-4 py-3 rounded-xl text-sm font-medium focus:border-brand outline-none" placeholder="e.g. Q2 Marketing Campaign" />
              </div>
              <div>
                <label className="block text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2">Description</label>
                <textarea value={newProjectDesc} onChange={e => setNewProjectDesc(e.target.value)} rows={3} className="w-full bg-white border-2 border-zinc-200 px-4 py-3 rounded-xl text-sm font-medium focus:border-brand outline-none resize-none" placeholder="What's this project about?" />
              </div>
              <div>
                <label className="block text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2">Due Date</label>
                <input type="date" value={newProjectDue} onChange={e => setNewProjectDue(e.target.value)} className="w-full bg-white border-2 border-zinc-200 px-4 py-3 rounded-xl text-sm font-medium focus:border-brand outline-none" />
              </div>
              <button onClick={handleCreateProject} disabled={saving || !newProjectTitle.trim()} className="w-full py-3 min-h-[44px] bg-brand text-white border border-black rounded-full font-bold text-sm uppercase tracking-wide flex items-center justify-center gap-2 disabled:opacity-50">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Create Project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Task Modal */}
      {showNewTask && selectedProject && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={() => setShowNewTask(false)}>
          <div className="bg-white rounded-2xl md:rounded-[40px] max-w-lg w-full p-6 md:p-8 shadow-elevation-3 border border-zinc-100" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-zinc-900">New Task</h3>
              <button onClick={() => setShowNewTask(false)} className="p-2 rounded-full hover:bg-zinc-100"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2">Task Title *</label>
                <input value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} className="w-full bg-white border-2 border-zinc-200 px-4 py-3 rounded-xl text-sm font-medium focus:border-brand outline-none" placeholder="e.g. Design social media graphics" />
              </div>
              <div>
                <label className="block text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2">Description</label>
                <textarea value={newTaskDesc} onChange={e => setNewTaskDesc(e.target.value)} rows={2} className="w-full bg-white border-2 border-zinc-200 px-4 py-3 rounded-xl text-sm font-medium focus:border-brand outline-none resize-none" placeholder="Details..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2">Assign To</label>
                  <AssigneePicker
                    value={newTaskAssigneeId}
                    onChange={(id, name) => { setNewTaskAssigneeId(id); setNewTaskAssigneeName(name); }}
                    volunteers={allVolunteers}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2">Priority</label>
                  <select value={newTaskPriority} onChange={e => setNewTaskPriority(e.target.value as any)} className="w-full bg-white border-2 border-zinc-200 px-4 py-3 rounded-xl text-sm font-medium focus:border-brand outline-none appearance-none">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2">Due Date</label>
                <input type="date" value={newTaskDue} onChange={e => setNewTaskDue(e.target.value)} className="w-full bg-white border-2 border-zinc-200 px-4 py-3 rounded-xl text-sm font-medium focus:border-brand outline-none" />
              </div>
              <button onClick={handleCreateTask} disabled={saving || !newTaskTitle.trim()} className="w-full py-3 min-h-[44px] bg-brand text-white border border-black rounded-full font-bold text-sm uppercase tracking-wide flex items-center justify-center gap-2 disabled:opacity-50">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectBoard;
