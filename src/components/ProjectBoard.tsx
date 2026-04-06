import React, { useState, useEffect, useRef } from 'react';
import { Volunteer, Project, ProjectTask } from '../types';
import { apiService } from '../services/apiService';
import { toastService } from '../services/toastService';
import {
  Plus, X, Calendar, Target, AlertTriangle,
  Loader2, Trash2, ArrowRight, Mail, Save,
  ChevronDown, Search, User, LayoutList, Kanban, ChevronRight,
  MoreHorizontal, CheckCircle2
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

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  todo: { bg: 'bg-zinc-100', text: 'text-zinc-500', label: 'To Do' },
  in_progress: { bg: 'bg-blue-100', text: 'text-blue-600', label: 'In Progress' },
  review: { bg: 'bg-amber-100', text: 'text-amber-600', label: 'Review' },
  done: { bg: 'bg-emerald-100', text: 'text-emerald-600', label: 'Done' },
};

const PRIORITY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  urgent: { bg: 'bg-rose-100', text: 'text-rose-600', label: 'Urgent' },
  high: { bg: 'bg-orange-100', text: 'text-orange-600', label: 'High' },
  medium: { bg: 'bg-blue-100', text: 'text-blue-600', label: 'Medium' },
  low: { bg: 'bg-zinc-100', text: 'text-zinc-500', label: 'Low' },
};

const fmt = (d?: string) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '—';

// Searchable assignee picker
const AssigneePicker: React.FC<{
  value: string;
  onChange: (id: string, name: string) => void;
  volunteers: Volunteer[];
}> = ({ value, onChange, volunteers }) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = volunteers.find(v => v.id === value);
  const filtered = volunteers
    .filter(v => v.status !== 'inactive')
    .filter(v => !query || v.name?.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 20);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between bg-white border-2 border-zinc-200 px-3 py-2.5 rounded-xl text-sm font-medium focus:border-brand outline-none text-left">
        <span className={active ? 'text-zinc-900' : 'text-zinc-400'}>{active ? active.name : 'Unassigned'}</span>
        <ChevronDown size={14} className="text-zinc-400 shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-zinc-200 rounded-xl shadow-elevation-2 overflow-hidden">
          <div className="p-2 border-b border-zinc-100">
            <div className="flex items-center gap-2 px-2 py-1.5 bg-zinc-50 rounded-lg">
              <Search size={12} className="text-zinc-400 shrink-0" />
              <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Search name..." className="flex-1 bg-transparent text-xs outline-none text-zinc-700" />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            <button type="button" onClick={() => { onChange('', ''); setOpen(false); setQuery(''); }}
              className="w-full text-left px-3 py-2 text-xs text-zinc-400 hover:bg-zinc-50 flex items-center gap-2">
              <User size={12} /> Unassigned
            </button>
            {filtered.map(v => (
              <button key={v.id} type="button" onClick={() => { onChange(v.id, v.name || ''); setOpen(false); setQuery(''); }}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-zinc-50 flex items-center gap-2 ${v.id === value ? 'text-brand font-bold' : 'text-zinc-700'}`}>
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
  const [viewMode, setViewMode] = useState<'board' | 'timeline'>('board');
  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set());

  // New project
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [newProjectDue, setNewProjectDue] = useState('');

  // New task
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskAssigneeId, setNewTaskAssigneeId] = useState('');
  const [newTaskAssigneeName, setNewTaskAssigneeName] = useState('');
  const [newTaskStartDate, setNewTaskStartDate] = useState('');
  const [newTaskDue, setNewTaskDue] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<ProjectTask['priority']>('medium');
  const [newTaskPhase, setNewTaskPhase] = useState('');
  const [saving, setSaving] = useState(false);

  // Phase management
  const [showNewPhase, setShowNewPhase] = useState(false);
  const [newPhaseName, setNewPhaseName] = useState('');

  // Task detail modal
  const [detailTask, setDetailTask] = useState<ProjectTask | null>(null);
  const [detailNotes, setDetailNotes] = useState('');
  const [detailAssigneeId, setDetailAssigneeId] = useState('');
  const [detailAssigneeName, setDetailAssigneeName] = useState('');
  const [detailStatus, setDetailStatus] = useState<ProjectTask['status']>('todo');
  const [detailPriority, setDetailPriority] = useState<ProjectTask['priority']>('medium');
  const [detailStartDate, setDetailStartDate] = useState('');
  const [detailDueDate, setDetailDueDate] = useState('');
  const [detailPhase, setDetailPhase] = useState('');
  const [savingDetail, setSavingDetail] = useState(false);

  // Vendor email
  const [showVendorEmail, setShowVendorEmail] = useState(false);
  const [vendorEmail, setVendorEmail] = useState('');
  const [vendorMessage, setVendorMessage] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  // Project actions menu
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const projectMenuRef = useRef<HTMLDivElement>(null);

  const canManage = user.isAdmin || ['Events Lead', 'Events Coordinator', 'Program Coordinator', 'General Operations Coordinator', 'Operations Coordinator', 'Development Coordinator', 'Outreach & Engagement Lead', 'Volunteer Lead'].includes(user.role);

  // All phases across tasks (+ project milestones as suggestions)
  const phaseOptions = Array.from(new Set([
    ...(selectedProject?.milestones?.map(m => m.title) || []),
    ...tasks.map(t => t.phase).filter(Boolean) as string[],
  ])).sort();

  useEffect(() => { loadProjects(); }, []);
  useEffect(() => { if (selectedProject) loadTasks(selectedProject.id); }, [selectedProject?.id]);

  useEffect(() => {
    if (detailTask) {
      setDetailNotes(detailTask.notes || '');
      setDetailAssigneeId(detailTask.assigneeId || '');
      setDetailAssigneeName(detailTask.assigneeName || '');
      setDetailStatus(detailTask.status);
      setDetailPriority(detailTask.priority);
      setDetailStartDate(detailTask.startDate || '');
      setDetailDueDate(detailTask.dueDate || '');
      setDetailPhase(detailTask.phase || '');
      setShowVendorEmail(false);
      setVendorEmail(''); setVendorMessage('');
    }
  }, [detailTask?.id]);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const data = await apiService.get('/api/projects');
      setProjects(data.projects || []);
      if (data.projects?.length > 0 && !selectedProject) setSelectedProject(data.projects[0]);
    } catch { toastService.error('Failed to load projects'); }
    finally { setLoading(false); }
  };

  const loadTasks = async (projectId: string) => {
    try {
      const data = await apiService.get(`/api/projects/${projectId}/tasks`);
      setTasks(data.tasks || []);
    } catch { setTasks([]); }
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
    } catch (e: any) { toastService.error(e.message); }
    finally { setSaving(false); }
  };

  const handleDeleteProject = async () => {
    if (!selectedProject) return;
    setShowProjectMenu(false);
    if (!confirm(`Delete project "${selectedProject.title}" and all its tasks? This cannot be undone.`)) return;
    try {
      await apiService.delete(`/api/projects/${selectedProject.id}`);
      const remaining = projects.filter(p => p.id !== selectedProject.id);
      setProjects(remaining);
      setSelectedProject(remaining[0] || null);
      setTasks([]);
      toastService.success('Project deleted');
    } catch (e: any) { toastService.error(e.message || 'Failed to delete project'); }
  };

  const handleMarkComplete = async () => {
    if (!selectedProject) return;
    setShowProjectMenu(false);
    try {
      await apiService.put(`/api/projects/${selectedProject.id}`, { status: 'completed' });
      const updated = { ...selectedProject, status: 'completed' as const };
      setSelectedProject(updated);
      setProjects(prev => prev.map(p => p.id === selectedProject.id ? updated : p));
      toastService.success('Project marked as complete');
    } catch (e: any) { toastService.error(e.message || 'Failed to update project'); }
  };

  // Close project menu on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (projectMenuRef.current && !projectMenuRef.current.contains(e.target as Node)) {
        setShowProjectMenu(false);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleAddPhase = async () => {
    if (!newPhaseName.trim() || !selectedProject) return;
    const newMilestone = { id: Date.now().toString(), title: newPhaseName.trim(), completed: false };
    const updatedMilestones = [...(selectedProject.milestones || []), newMilestone];
    try {
      await apiService.put(`/api/projects/${selectedProject.id}`, { milestones: updatedMilestones });
      const updated = { ...selectedProject, milestones: updatedMilestones };
      setSelectedProject(updated);
      setProjects(prev => prev.map(p => p.id === selectedProject.id ? updated : p));
      setNewPhaseName(''); setShowNewPhase(false);
      toastService.success(`Phase "${newMilestone.title}" added`);
    } catch { toastService.error('Failed to add phase'); }
  };

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim() || !selectedProject) return;
    setSaving(true);
    try {
      const result = await apiService.post(`/api/projects/${selectedProject.id}/tasks`, {
        title: newTaskTitle, description: newTaskDesc,
        assigneeId: newTaskAssigneeId || undefined,
        assigneeName: newTaskAssigneeName || undefined,
        startDate: newTaskStartDate || undefined,
        dueDate: newTaskDue || undefined,
        priority: newTaskPriority,
        phase: newTaskPhase || undefined,
      });
      setTasks(prev => [...prev, { id: result.id, ...result }]);
      setShowNewTask(false);
      setNewTaskTitle(''); setNewTaskDesc('');
      setNewTaskAssigneeId(''); setNewTaskAssigneeName('');
      setNewTaskStartDate(''); setNewTaskDue('');
      setNewTaskPriority('medium'); setNewTaskPhase('');
    } catch (e: any) { toastService.error(e.message); }
    finally { setSaving(false); }
  };

  const handleMoveTask = async (taskId: string, newStatus: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus as ProjectTask['status'] } : t));
    if (detailTask?.id === taskId) setDetailStatus(newStatus as ProjectTask['status']);
    try {
      await apiService.put(`/api/projects/${selectedProject!.id}/tasks/${taskId}`, { status: newStatus });
    } catch { loadTasks(selectedProject!.id); toastService.error('Failed to update task'); }
  };

  const handleDeleteTask = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this task?')) return;
    try {
      await apiService.delete(`/api/projects/${selectedProject!.id}/tasks/${taskId}`);
      setTasks(prev => prev.filter(t => t.id !== taskId));
      if (detailTask?.id === taskId) setDetailTask(null);
    } catch { toastService.error('Failed to delete task'); }
  };

  const handleSaveDetail = async () => {
    if (!detailTask || !selectedProject) return;
    setSavingDetail(true);
    const updates = {
      status: detailStatus, priority: detailPriority,
      assigneeId: detailAssigneeId || null, assigneeName: detailAssigneeName || null,
      notes: detailNotes, startDate: detailStartDate || null,
      dueDate: detailDueDate || null, phase: detailPhase || null,
    };
    try {
      await apiService.put(`/api/projects/${selectedProject.id}/tasks/${detailTask.id}`, updates);
      setTasks(prev => prev.map(t => t.id === detailTask.id ? { ...t, ...updates } : t));
      setDetailTask(prev => prev ? { ...prev, ...updates } : null);
      toastService.success('Task saved');
    } catch { toastService.error('Failed to save task'); }
    finally { setSavingDetail(false); }
  };

  const handleSendVendorEmail = async () => {
    if (!vendorEmail.trim() || !detailTask || !selectedProject) return;
    setSendingEmail(true);
    try {
      await apiService.post(`/api/projects/${selectedProject.id}/tasks/${detailTask.id}/email-vendor`, {
        toEmail: vendorEmail, message: vendorMessage,
        taskTitle: detailTask.title, taskDescription: detailTask.description,
        projectTitle: selectedProject.title, senderName: user.name,
      });
      toastService.success(`Email sent to ${vendorEmail}`);
      setShowVendorEmail(false); setVendorEmail(''); setVendorMessage('');
    } catch { toastService.error('Failed to send email'); }
    finally { setSendingEmail(false); }
  };

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter(t => t.status === 'done').length;
  const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const overdueTasks = tasks.filter(t => t.dueDate && t.status !== 'done' && t.dueDate < new Date().toISOString().split('T')[0]).length;

  // Timeline: group tasks by phase
  const timelineGroups = (() => {
    const ungrouped: ProjectTask[] = [];
    const map = new Map<string, ProjectTask[]>();
    // Use phase order from project milestones first, then alphabetical
    const orderedPhases = [
      ...(selectedProject?.milestones?.map(m => m.title) || []),
      ...tasks.map(t => t.phase).filter((p): p is string => !!p && !(selectedProject?.milestones?.map(m => m.title) || []).includes(p)),
    ].filter((v, i, a) => a.indexOf(v) === i);

    for (const task of tasks) {
      if (!task.phase) { ungrouped.push(task); continue; }
      if (!map.has(task.phase)) map.set(task.phase, []);
      map.get(task.phase)!.push(task);
    }
    const groups: { phase: string; tasks: ProjectTask[] }[] = orderedPhases
      .filter(p => map.has(p))
      .map(p => ({ phase: p, tasks: map.get(p)! }));
    if (ungrouped.length > 0) groups.push({ phase: 'Unassigned', tasks: ungrouped });
    return groups;
  })();

  if (loading) return <div className="flex items-center justify-center py-32"><Loader2 size={32} className="animate-spin text-brand" /></div>;

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
              {p.status === 'completed' ? <CheckCircle2 size={14} className={selectedProject?.id === p.id ? 'text-white' : 'text-emerald-500'} /> : <Target size={14} />}
              {p.title}
              {p.status === 'completed' && (
                <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wide ${selectedProject?.id === p.id ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-600'}`}>Done</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Project stats */}
      {selectedProject && (
        <div className="bg-white p-4 md:p-6 rounded-2xl md:rounded-[40px] border border-zinc-100 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-lg font-black text-zinc-900">{selectedProject.title}</h3>
                {selectedProject.status === 'completed' && (
                  <span className="flex items-center gap-1 px-2.5 py-0.5 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-black uppercase tracking-wide">
                    <CheckCircle2 size={11} /> Completed
                  </span>
                )}
              </div>
              {selectedProject.description && <p className="text-sm text-zinc-500 mt-1">{selectedProject.description}</p>}
            </div>
            <div className="flex items-center gap-3 text-sm flex-wrap">
              {selectedProject.dueDate && (
                <span className="flex items-center gap-1.5 text-zinc-500 font-bold">
                  <Calendar size={14} /> Due {fmt(selectedProject.dueDate)}
                </span>
              )}
              {overdueTasks > 0 && (
                <span className="flex items-center gap-1.5 text-rose-500 font-bold"><AlertTriangle size={14} /> {overdueTasks} overdue</span>
              )}
              {canManage && (
                <div ref={projectMenuRef} className="relative">
                  <button
                    onClick={() => setShowProjectMenu(o => !o)}
                    className="flex items-center justify-center w-8 h-8 rounded-full border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-500 transition-colors"
                    title="Project actions"
                  >
                    <MoreHorizontal size={15} />
                  </button>
                  {showProjectMenu && (
                    <div className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-zinc-200 rounded-xl shadow-elevation-2 overflow-hidden z-50">
                      {selectedProject.status !== 'completed' && (
                        <button
                          onClick={handleMarkComplete}
                          className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-bold text-zinc-900 hover:bg-zinc-50 transition-colors border-b border-zinc-100"
                        >
                          <span className="w-2 h-2 rounded-full bg-zinc-900 shrink-0" />
                          Mark as Complete
                        </button>
                      )}
                      {user.isAdmin && (
                        <button
                          onClick={handleDeleteProject}
                          className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-bold text-rose-600 hover:bg-rose-50 transition-colors border border-zinc-200 rounded-b-xl"
                        >
                          <Trash2 size={14} className="shrink-0" />
                          Delete Project
                        </button>
                      )}
                    </div>
                  )}
                </div>
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

      {/* View toggle + actions */}
      {selectedProject && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-full">
            <button onClick={() => setViewMode('board')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all ${viewMode === 'board' ? 'bg-white shadow text-zinc-800' : 'text-zinc-400 hover:text-zinc-600'}`}>
              <Kanban size={13} /> Board
            </button>
            <button onClick={() => setViewMode('timeline')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all ${viewMode === 'timeline' ? 'bg-white shadow text-zinc-800' : 'text-zinc-400 hover:text-zinc-600'}`}>
              <LayoutList size={13} /> Timeline
            </button>
          </div>
          <div className="flex items-center gap-2">
            {canManage && viewMode === 'timeline' && (
              <button onClick={() => setShowNewPhase(true)}
                className="px-4 py-2 min-h-[44px] bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-full text-xs font-bold uppercase tracking-wide flex items-center gap-1.5">
                <Plus size={13} /> Add Phase
              </button>
            )}
            {canManage && (
              <button onClick={() => setShowNewTask(true)}
                className="px-4 py-2 min-h-[44px] bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-full text-xs font-bold uppercase tracking-wide flex items-center gap-2">
                <Plus size={14} /> Add Task
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── BOARD VIEW ── */}
      {selectedProject && viewMode === 'board' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {COLUMNS.map(col => {
            const columnTasks = tasks.filter(t => t.status === col.id).sort((a, b) => {
              const o: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
              return (o[a.priority] ?? 2) - (o[b.priority] ?? 2);
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
                    return (
                      <div key={task.id} onClick={() => setDetailTask(task)}
                        className={`bg-white rounded-xl p-3 border shadow-sm hover:shadow-md transition-shadow cursor-pointer ${isOverdue ? 'border-rose-200' : 'border-zinc-100'}`}>
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
                          {task.phase && <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-violet-50 text-violet-500">{task.phase}</span>}
                          {task.notes && <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-500">Notes</span>}
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
                                <Calendar size={9} /> {fmt(task.dueDate)}
                              </span>
                            )}
                          </div>
                          {nextCol && canManage && (
                            <button onClick={e => handleMoveTask(task.id, nextCol.id, e)}
                              className="p-1.5 rounded-full bg-zinc-100 hover:bg-brand hover:text-white text-zinc-400 transition-colors" title={`Move to ${nextCol.label}`}>
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
      )}

      {/* ── TIMELINE VIEW ── */}
      {selectedProject && viewMode === 'timeline' && (
        <div className="space-y-4">
          {/* Phase legend */}
          {phaseOptions.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em]">Phases:</span>
              {phaseOptions.map(p => (
                <span key={p} className="px-2.5 py-1 bg-violet-50 text-violet-600 text-[10px] font-bold rounded-full border border-violet-100">{p}</span>
              ))}
            </div>
          )}

          {timelineGroups.length === 0 && (
            <div className="py-16 text-center bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
              <LayoutList className="mx-auto text-zinc-200 mb-4" size={40} strokeWidth={1.5} />
              <p className="text-zinc-400 font-bold text-sm">No tasks yet.</p>
              <p className="text-zinc-300 text-xs mt-1">Add tasks and assign them to phases to build your timeline.</p>
            </div>
          )}

          {timelineGroups.map(({ phase, tasks: phaseTasks }) => {
            const isCollapsed = collapsedPhases.has(phase);
            const doneCount = phaseTasks.filter(t => t.status === 'done').length;
            return (
              <div key={phase} className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
                {/* Phase header */}
                <button
                  onClick={() => setCollapsedPhases(prev => { const s = new Set(prev); s.has(phase) ? s.delete(phase) : s.add(phase); return s; })}
                  className="w-full flex items-center justify-between px-4 md:px-6 py-3 bg-[#1a2650] text-white text-left"
                >
                  <div className="flex items-center gap-3">
                    <ChevronRight size={14} className={`transition-transform ${isCollapsed ? '' : 'rotate-90'}`} />
                    <span className="text-sm font-black tracking-wide">{phase}</span>
                    <span className="text-[10px] font-bold text-white/50">{phaseTasks.length} tasks</span>
                  </div>
                  <span className="text-[10px] font-bold text-white/60">{doneCount}/{phaseTasks.length} done</span>
                </button>

                {!isCollapsed && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-100 bg-zinc-50">
                          <th className="text-left px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.15em] text-zinc-400 min-w-[240px]">Item / Task</th>
                          <th className="text-left px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.15em] text-zinc-400 whitespace-nowrap">Start Date</th>
                          <th className="text-left px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.15em] text-zinc-400 whitespace-nowrap">Completion Date</th>
                          <th className="text-left px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.15em] text-zinc-400">Assigned</th>
                          <th className="text-left px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.15em] text-zinc-400">Status</th>
                          <th className="px-3 py-2.5 w-8" />
                        </tr>
                      </thead>
                      <tbody>
                        {phaseTasks.map((task, i) => {
                          const isOverdue = task.dueDate && task.status !== 'done' && task.dueDate < new Date().toISOString().split('T')[0];
                          const sStyle = STATUS_STYLES[task.status] || STATUS_STYLES.todo;
                          return (
                            <tr key={task.id}
                              onClick={() => setDetailTask(task)}
                              className={`border-b border-zinc-50 hover:bg-zinc-50/80 cursor-pointer transition-colors ${i % 2 === 0 ? '' : 'bg-zinc-50/30'}`}>
                              <td className="px-4 py-3">
                                <div className="flex items-start gap-2">
                                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${PRIORITY_STYLES[task.priority]?.bg.replace('bg-', 'bg-').replace('-100', '-400')}`} />
                                  <div>
                                    <p className="font-semibold text-zinc-800 leading-tight">{task.title}</p>
                                    {task.description && <p className="text-xs text-zinc-400 mt-0.5 line-clamp-1">{task.description}</p>}
                                    {task.notes && <p className="text-[10px] text-amber-500 font-bold mt-0.5">📝 Has notes</p>}
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-3 text-xs text-zinc-500 whitespace-nowrap font-medium">{fmt(task.startDate)}</td>
                              <td className={`px-3 py-3 text-xs whitespace-nowrap font-medium ${isOverdue ? 'text-rose-500 font-bold' : 'text-zinc-500'}`}>
                                {fmt(task.dueDate)}{isOverdue ? ' ⚠' : ''}
                              </td>
                              <td className="px-3 py-3">
                                {task.assigneeName ? (
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-5 h-5 rounded-full bg-brand text-white flex items-center justify-center text-[9px] font-bold shrink-0">
                                      {task.assigneeName.charAt(0)}
                                    </div>
                                    <span className="text-xs text-zinc-600 font-medium truncate max-w-[100px]">{task.assigneeName}</span>
                                  </div>
                                ) : <span className="text-xs text-zinc-300">—</span>}
                              </td>
                              <td className="px-3 py-3">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${sStyle.bg} ${sStyle.text}`}>{sStyle.label}</span>
                              </td>
                              <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                                {canManage && (
                                  <button onClick={e => handleDeleteTask(task.id, e)} className="p-1 text-zinc-200 hover:text-rose-400 transition-colors">
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
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
            <div className="flex items-start justify-between p-5 md:p-6 border-b border-zinc-100 gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${PRIORITY_STYLES[detailTask.priority]?.bg} ${PRIORITY_STYLES[detailTask.priority]?.text}`}>
                    {PRIORITY_STYLES[detailTask.priority]?.label}
                  </span>
                  {detailTask.phase && <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-violet-50 text-violet-500">{detailTask.phase}</span>}
                </div>
                <h3 className="text-lg font-black text-zinc-900 leading-tight">{detailTask.title}</h3>
                {detailTask.createdAt && <p className="text-xs text-zinc-400 mt-0.5">Added {new Date(detailTask.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>}
              </div>
              <button onClick={() => setDetailTask(null)} className="p-2 rounded-full hover:bg-zinc-100 shrink-0"><X size={18} /></button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 md:p-6 space-y-4">
              {detailTask.description && (
                <div>
                  <p className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.15em] mb-1">Description</p>
                  <p className="text-sm text-zinc-700 leading-relaxed">{detailTask.description}</p>
                </div>
              )}

              {/* Status + Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black text-zinc-400 uppercase tracking-[0.15em] mb-1.5">Status</label>
                  <select value={detailStatus} onChange={e => setDetailStatus(e.target.value as ProjectTask['status'])}
                    className="w-full bg-white border-2 border-zinc-200 px-3 py-2 rounded-xl text-sm font-medium focus:border-brand outline-none appearance-none">
                    {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-black text-zinc-400 uppercase tracking-[0.15em] mb-1.5">Priority</label>
                  <select value={detailPriority} onChange={e => setDetailPriority(e.target.value as ProjectTask['priority'])}
                    className="w-full bg-white border-2 border-zinc-200 px-3 py-2 rounded-xl text-sm font-medium focus:border-brand outline-none appearance-none">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              {/* Phase */}
              <div>
                <label className="block text-[11px] font-black text-zinc-400 uppercase tracking-[0.15em] mb-1.5">Phase / Range</label>
                <input list="phase-options" value={detailPhase} onChange={e => setDetailPhase(e.target.value)}
                  placeholder="e.g. February 2026, March 2026..."
                  className="w-full bg-white border-2 border-zinc-200 px-3 py-2.5 rounded-xl text-sm font-medium focus:border-brand outline-none" />
                <datalist id="phase-options">
                  {phaseOptions.map(p => <option key={p} value={p} />)}
                </datalist>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black text-zinc-400 uppercase tracking-[0.15em] mb-1.5">Start Date</label>
                  <input type="date" value={detailStartDate} onChange={e => setDetailStartDate(e.target.value)}
                    className="w-full bg-white border-2 border-zinc-200 px-3 py-2 rounded-xl text-sm font-medium focus:border-brand outline-none" />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-zinc-400 uppercase tracking-[0.15em] mb-1.5">Completion Date</label>
                  <input type="date" value={detailDueDate} onChange={e => setDetailDueDate(e.target.value)}
                    className="w-full bg-white border-2 border-zinc-200 px-3 py-2 rounded-xl text-sm font-medium focus:border-brand outline-none" />
                </div>
              </div>

              {/* Assignee */}
              <div>
                <label className="block text-[11px] font-black text-zinc-400 uppercase tracking-[0.15em] mb-1.5">Assigned To</label>
                <AssigneePicker value={detailAssigneeId} onChange={(id, name) => { setDetailAssigneeId(id); setDetailAssigneeName(name); }} volunteers={allVolunteers} />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[11px] font-black text-zinc-400 uppercase tracking-[0.15em] mb-1.5">Internal Notes</label>
                <textarea value={detailNotes} onChange={e => setDetailNotes(e.target.value)} rows={3}
                  placeholder="Add notes visible to your team..."
                  className="w-full bg-white border-2 border-zinc-200 px-3 py-2.5 rounded-xl text-sm font-medium focus:border-brand outline-none resize-none" />
              </div>

              {/* Vendor Email */}
              <div>
                <button onClick={() => setShowVendorEmail(v => !v)}
                  className="flex items-center gap-2 text-xs font-bold text-zinc-500 hover:text-brand transition-colors">
                  <Mail size={13} /> Email External Vendor / Contact
                </button>
                {showVendorEmail && (
                  <div className="mt-3 p-4 bg-zinc-50 rounded-xl border border-zinc-200 space-y-3">
                    <p className="text-xs text-zinc-400">Send this task's details to an outside contact.</p>
                    <input type="email" value={vendorEmail} onChange={e => setVendorEmail(e.target.value)}
                      placeholder="vendor@example.com"
                      className="w-full bg-white border-2 border-zinc-200 px-3 py-2 rounded-xl text-sm font-medium focus:border-brand outline-none" />
                    <textarea value={vendorMessage} onChange={e => setVendorMessage(e.target.value)} rows={2}
                      placeholder="Additional instructions..."
                      className="w-full bg-white border-2 border-zinc-200 px-3 py-2 rounded-xl text-sm font-medium focus:border-brand outline-none resize-none" />
                    <button onClick={handleSendVendorEmail} disabled={sendingEmail || !vendorEmail.trim()}
                      className="w-full py-2 bg-brand text-white border border-black rounded-full font-bold text-xs uppercase tracking-wide flex items-center justify-center gap-2 disabled:opacity-50">
                      {sendingEmail ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />} Send Email
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 md:p-5 border-t border-zinc-100 flex gap-3">
              <button onClick={() => setDetailTask(null)} className="flex-1 py-2.5 border-2 border-zinc-200 text-zinc-600 rounded-full font-bold text-sm">Close</button>
              {canManage && (
                <button onClick={handleSaveDetail} disabled={savingDetail}
                  className="flex-1 py-2.5 bg-brand text-white border border-black rounded-full font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                  {savingDetail ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Changes
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Phase Modal */}
      {showNewPhase && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={() => setShowNewPhase(false)}>
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-elevation-3 border border-zinc-100" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-zinc-900">Add Phase</h3>
              <button onClick={() => setShowNewPhase(false)} className="p-2 rounded-full hover:bg-zinc-100"><X size={18} /></button>
            </div>
            <p className="text-xs text-zinc-400 mb-4">Phases group tasks into time ranges (e.g. "February 2026", "Pre-Event", "After the Event").</p>
            <input value={newPhaseName} onChange={e => setNewPhaseName(e.target.value)}
              placeholder="e.g. February 2026"
              className="w-full bg-white border-2 border-zinc-200 px-4 py-3 rounded-xl text-sm font-medium focus:border-brand outline-none mb-4"
              onKeyDown={e => e.key === 'Enter' && handleAddPhase()} />
            <button onClick={handleAddPhase} disabled={!newPhaseName.trim()}
              className="w-full py-3 bg-brand text-white border border-black rounded-full font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
              <Plus size={14} /> Add Phase
            </button>
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
                <input value={newProjectTitle} onChange={e => setNewProjectTitle(e.target.value)}
                  className="w-full bg-white border-2 border-zinc-200 px-4 py-3 rounded-xl text-sm font-medium focus:border-brand outline-none" placeholder="e.g. Take Action LA Campaign" />
              </div>
              <div>
                <label className="block text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2">Description</label>
                <textarea value={newProjectDesc} onChange={e => setNewProjectDesc(e.target.value)} rows={3}
                  className="w-full bg-white border-2 border-zinc-200 px-4 py-3 rounded-xl text-sm font-medium focus:border-brand outline-none resize-none" placeholder="What's this project about?" />
              </div>
              <div>
                <label className="block text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2">Due Date</label>
                <input type="date" value={newProjectDue} onChange={e => setNewProjectDue(e.target.value)}
                  className="w-full bg-white border-2 border-zinc-200 px-4 py-3 rounded-xl text-sm font-medium focus:border-brand outline-none" />
              </div>
              <button onClick={handleCreateProject} disabled={saving || !newProjectTitle.trim()}
                className="w-full py-3 min-h-[44px] bg-brand text-white border border-black rounded-full font-bold text-sm uppercase tracking-wide flex items-center justify-center gap-2 disabled:opacity-50">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Create Project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Task Modal */}
      {showNewTask && selectedProject && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={() => setShowNewTask(false)}>
          <div className="bg-white rounded-2xl md:rounded-[40px] max-w-lg w-full p-6 md:p-8 shadow-elevation-3 border border-zinc-100 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-zinc-900">New Task</h3>
              <button onClick={() => setShowNewTask(false)} className="p-2 rounded-full hover:bg-zinc-100"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2">Task Title *</label>
                <input value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)}
                  className="w-full bg-white border-2 border-zinc-200 px-4 py-3 rounded-xl text-sm font-medium focus:border-brand outline-none" placeholder="e.g. Confirm venue booking" />
              </div>
              <div>
                <label className="block text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2">Description</label>
                <textarea value={newTaskDesc} onChange={e => setNewTaskDesc(e.target.value)} rows={2}
                  className="w-full bg-white border-2 border-zinc-200 px-4 py-3 rounded-xl text-sm font-medium focus:border-brand outline-none resize-none" placeholder="Details..." />
              </div>
              <div>
                <label className="block text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2">Phase / Range</label>
                <input list="new-phase-options" value={newTaskPhase} onChange={e => setNewTaskPhase(e.target.value)}
                  placeholder="e.g. February 2026"
                  className="w-full bg-white border-2 border-zinc-200 px-4 py-3 rounded-xl text-sm font-medium focus:border-brand outline-none" />
                <datalist id="new-phase-options">
                  {phaseOptions.map(p => <option key={p} value={p} />)}
                </datalist>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2">Start Date</label>
                  <input type="date" value={newTaskStartDate} onChange={e => setNewTaskStartDate(e.target.value)}
                    className="w-full bg-white border-2 border-zinc-200 px-3 py-2.5 rounded-xl text-sm font-medium focus:border-brand outline-none" />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2">Completion Date</label>
                  <input type="date" value={newTaskDue} onChange={e => setNewTaskDue(e.target.value)}
                    className="w-full bg-white border-2 border-zinc-200 px-3 py-2.5 rounded-xl text-sm font-medium focus:border-brand outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2">Assign To</label>
                  <AssigneePicker value={newTaskAssigneeId} onChange={(id, name) => { setNewTaskAssigneeId(id); setNewTaskAssigneeName(name); }} volunteers={allVolunteers} />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2">Priority</label>
                  <select value={newTaskPriority} onChange={e => setNewTaskPriority(e.target.value as any)}
                    className="w-full bg-white border-2 border-zinc-200 px-4 py-3 rounded-xl text-sm font-medium focus:border-brand outline-none appearance-none">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <button onClick={handleCreateTask} disabled={saving || !newTaskTitle.trim()}
                className="w-full py-3 min-h-[44px] bg-brand text-white border border-black rounded-full font-bold text-sm uppercase tracking-wide flex items-center justify-center gap-2 disabled:opacity-50">
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
