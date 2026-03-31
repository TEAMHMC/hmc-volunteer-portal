import React, { useState, useEffect } from 'react';
import { Volunteer, Project, ProjectTask } from '../types';
import { apiService } from '../services/apiService';
import { toastService } from '../services/toastService';
import {
  Plus, X, Calendar, Users, Target, CheckCircle, Clock, AlertTriangle,
  Loader2, Trash2, ChevronRight, Flag, GripVertical, Save, ArrowRight
} from 'lucide-react';

interface ProjectBoardProps {
  user: Volunteer;
  allVolunteers: Volunteer[];
}

const COLUMNS = [
  { id: 'todo', label: 'To Do', color: 'bg-zinc-100 text-zinc-600', dot: 'bg-zinc-400' },
  { id: 'in_progress', label: 'In Progress', color: 'bg-blue-100 text-blue-600', dot: 'bg-blue-500' },
  { id: 'review', label: 'Review', color: 'bg-amber-100 text-amber-600', dot: 'bg-amber-500' },
  { id: 'done', label: 'Done', color: 'bg-emerald-100 text-emerald-600', dot: 'bg-emerald-500' },
] as const;

const PRIORITY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  urgent: { bg: 'bg-rose-100', text: 'text-rose-600', label: 'Urgent' },
  high: { bg: 'bg-orange-100', text: 'text-orange-600', label: 'High' },
  medium: { bg: 'bg-blue-100', text: 'text-blue-600', label: 'Medium' },
  low: { bg: 'bg-zinc-100', text: 'text-zinc-500', label: 'Low' },
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
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [newTaskDue, setNewTaskDue] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [saving, setSaving] = useState(false);

  const canManage = user.isAdmin || ['Events Lead', 'Events Coordinator', 'Program Coordinator', 'General Operations Coordinator', 'Operations Coordinator', 'Development Coordinator', 'Outreach & Engagement Lead', 'Volunteer Lead'].includes(user.role);

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (selectedProject) loadTasks(selectedProject.id);
  }, [selectedProject?.id]);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const data = await apiService.get('/api/projects');
      setProjects(data.projects || []);
      if (data.projects?.length > 0 && !selectedProject) {
        setSelectedProject(data.projects[0]);
      }
    } catch (e: any) {
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
        title: newProjectTitle,
        description: newProjectDesc,
        dueDate: newProjectDue || undefined,
        teamMemberIds: [user.id],
      });
      const newProject = { id: result.id, ...result };
      setProjects(prev => [newProject, ...prev]);
      setSelectedProject(newProject);
      setShowNewProject(false);
      setNewProjectTitle('');
      setNewProjectDesc('');
      setNewProjectDue('');
      toastService.success('Project created');
    } catch (e: any) {
      toastService.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim() || !selectedProject) return;
    setSaving(true);
    const assignee = allVolunteers.find(v => v.id === newTaskAssignee);
    try {
      const result = await apiService.post(`/api/projects/${selectedProject.id}/tasks`, {
        title: newTaskTitle,
        description: newTaskDesc,
        assigneeId: newTaskAssignee || undefined,
        assigneeName: assignee?.name || undefined,
        dueDate: newTaskDue || undefined,
        priority: newTaskPriority,
      });
      setTasks(prev => [...prev, { id: result.id, ...result }]);
      setShowNewTask(false);
      setNewTaskTitle('');
      setNewTaskDesc('');
      setNewTaskAssignee('');
      setNewTaskDue('');
      setNewTaskPriority('medium');
    } catch (e: any) {
      toastService.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleMoveTask = async (taskId: string, newStatus: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus as ProjectTask['status'] } : t));
    try {
      await apiService.put(`/api/projects/${selectedProject!.id}/tasks/${taskId}`, { status: newStatus });
    } catch {
      loadTasks(selectedProject!.id);
      toastService.error('Failed to update task');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Delete this task?')) return;
    try {
      await apiService.delete(`/api/projects/${selectedProject!.id}/tasks/${taskId}`);
      setTasks(prev => prev.filter(t => t.id !== taskId));
    } catch {
      toastService.error('Failed to delete task');
    }
  };

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter(t => t.status === 'done').length;
  const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const overdueTasks = tasks.filter(t => t.dueDate && t.status !== 'done' && t.dueDate < new Date().toISOString().split('T')[0]).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={32} className="animate-spin text-brand" />
      </div>
    );
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
            <button
              key={p.id}
              onClick={() => setSelectedProject(p)}
              className={`px-4 md:px-6 py-3 rounded-full text-[11px] font-black uppercase tracking-[0.15em] whitespace-nowrap flex items-center gap-2 transition-all min-h-[44px] ${
                selectedProject?.id === p.id ? 'bg-brand text-white shadow-elevation-2' : 'bg-white text-zinc-400 border border-zinc-100 hover:text-zinc-600'
              }`}
            >
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
            <div className="flex items-center gap-4 text-sm">
              {selectedProject.dueDate && (
                <span className="flex items-center gap-1.5 text-zinc-500 font-bold">
                  <Calendar size={14} /> Due {new Date(selectedProject.dueDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              )}
              {overdueTasks > 0 && (
                <span className="flex items-center gap-1.5 text-rose-500 font-bold">
                  <AlertTriangle size={14} /> {overdueTasks} overdue
                </span>
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
                const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
                return (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
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
                      // Next status for quick-move button
                      const colIdx = COLUMNS.findIndex(c => c.id === col.id);
                      const nextCol = colIdx < COLUMNS.length - 1 ? COLUMNS[colIdx + 1] : null;

                      return (
                        <div key={task.id} className={`bg-white rounded-xl p-3 border shadow-sm hover:shadow-md transition-shadow ${isOverdue ? 'border-rose-200' : 'border-zinc-100'}`}>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <p className="text-sm font-bold text-zinc-900 leading-tight flex-1">{task.title}</p>
                            {canManage && (
                              <button onClick={() => handleDeleteTask(task.id)} className="p-1 text-zinc-300 hover:text-rose-500 shrink-0">
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                          {task.description && <p className="text-xs text-zinc-400 mb-2 line-clamp-2">{task.description}</p>}
                          <div className="flex items-center gap-1.5 flex-wrap mb-2">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${pStyle.bg} ${pStyle.text}`}>
                              {pStyle.label}
                            </span>
                            {task.labels?.map(label => (
                              <span key={label} className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-brand/10 text-brand">{label}</span>
                            ))}
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
                                  <Clock size={10} /> {new Date(task.dueDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                              )}
                            </div>
                            {nextCol && canManage && (
                              <button
                                onClick={() => handleMoveTask(task.id, nextCol.id)}
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
                  <select value={newTaskAssignee} onChange={e => setNewTaskAssignee(e.target.value)} className="w-full bg-white border-2 border-zinc-200 px-4 py-3 rounded-xl text-sm font-medium focus:border-brand outline-none appearance-none">
                    <option value="">Unassigned</option>
                    {allVolunteers.filter(v => v.status !== 'inactive').slice(0, 50).map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
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
