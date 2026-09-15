import React, { useMemo, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { toast } from "sonner";

const COLUMNS = [
  { key: "backlog", label: "Backlog" },
  { key: "todo", label: "To Do" },
  { key: "in_progress", label: "In Progress" },
  { key: "review", label: "In Review" },
  { key: "done", label: "Done" },
];

const PRIORITY = {
  low: { label: "Low", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  medium: { label: "Medium", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  high: { label: "High", cls: "bg-orange-50 text-orange-700 border-orange-200" },
  urgent: { label: "Urgent", cls: "bg-red-50 text-red-700 border-red-200" },
};

export default function KanbanBoard({ projectId, members = [], showProjectPicker = false, autoOpenNew = false }) {
  const qc = useQueryClient();
  const [selectedProject, setSelectedProject] = useState(projectId || "");
  const [openNew, setOpenNew] = useState(autoOpenNew);
  const [dragOver, setDragOver] = useState(null);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => (await api.get("/projects")).data,
    enabled: showProjectPicker,
  });

  useEffect(() => {
    if (showProjectPicker && !selectedProject && projects.length) {
      setSelectedProject(projects[0].id);
    }
  }, [projects, selectedProject, showProjectPicker]);

  const activeProject = projectId || selectedProject;

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", activeProject],
    queryFn: async () => (await api.get(`/tasks?project_id=${activeProject}`)).data,
    enabled: !!activeProject,
  });

  const byStatus = useMemo(() => {
    const map = { backlog: [], todo: [], in_progress: [], review: [], done: [] };
    tasks.forEach((t) => { (map[t.status] || (map[t.status] = [])).push(t); });
    return map;
  }, [tasks]);

  const updateMut = useMutation({
    mutationFn: async ({ id, patch }) => (await api.put(`/tasks/${id}`, patch)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks", activeProject] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
  const deleteMut = useMutation({
    mutationFn: async (id) => (await api.delete(`/tasks/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks", activeProject] });
      toast.success("Task deleted");
    },
  });
  const createMut = useMutation({
    mutationFn: async (payload) => (await api.post("/tasks", payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks", activeProject] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Task created");
    },
  });

  const onDragStart = (e, task) => {
    e.dataTransfer.setData("text/plain", task.id);
    e.dataTransfer.effectAllowed = "move";
  };
  const onDragOver = (e, col) => {
    e.preventDefault();
    setDragOver(col);
  };
  const onDrop = (e, col) => {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData("text/plain");
    const t = tasks.find((x) => x.id === id);
    if (!t || t.status === col) return;
    updateMut.mutate({ id, patch: { status: col } });
    if (col === "done") toast.success("Marked complete");
  };

  return (
    <div className="space-y-4">
      {showProjectPicker && (
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-[260px]" data-testid="kanban-project-select">
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="ml-auto">
            <Button
              onClick={() => setOpenNew(true)}
              className="bg-indigo-600 hover:bg-indigo-700"
              disabled={!activeProject}
              data-testid="kanban-new-task-button"
            >
              <Plus className="w-4 h-4 mr-1.5" /> New task
            </Button>
          </div>
        </div>
      )}

      {!showProjectPicker && (
        <div className="flex justify-end">
          <Button onClick={() => setOpenNew(true)} className="bg-indigo-600 hover:bg-indigo-700" data-testid="kanban-new-task-button">
            <Plus className="w-4 h-4 mr-1.5" /> New task
          </Button>
        </div>
      )}

      {!activeProject ? (
        <Card className="p-10 text-center text-sm text-slate-500">Select a project to view its Kanban board.</Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          {COLUMNS.map((col) => (
            <div
              key={col.key}
              data-testid={`kanban-column-${col.key}`}
              onDragOver={(e) => onDragOver(e, col.key)}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => onDrop(e, col.key)}
              className={`rounded-lg border border-slate-200 bg-slate-50/60 p-3 min-h-[300px] ${dragOver === col.key ? "kanban-drag-over" : ""}`}
            >
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-600">{col.label}</div>
                <span className="text-[11px] text-slate-400">{byStatus[col.key]?.length || 0}</span>
              </div>
              <div className="space-y-2.5">
                {(byStatus[col.key] || []).map((t) => {
                  const assignee = members.find((m) => m.id === t.assignee_id);
                  const overdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== "done";
                  return (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={(e) => onDragStart(e, t)}
                      data-testid={`kanban-task-card-${t.id}`}
                      className="group rounded-md border border-slate-200 bg-white p-3 shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing"
                    >
                      <div className="flex items-start gap-2">
                        <GripVertical className="w-3.5 h-3.5 text-slate-300 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium leading-snug">{t.title}</div>
                          {t.description && <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{t.description}</div>}
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <Badge className={`${PRIORITY[t.priority]?.cls || ""} border capitalize text-[10px]`}>{PRIORITY[t.priority]?.label || t.priority}</Badge>
                            {assignee && (
                              <Avatar className="w-5 h-5"><AvatarImage src={assignee.avatar_url} /><AvatarFallback>{assignee.name.slice(0,1)}</AvatarFallback></Avatar>
                            )}
                          </div>
                          {t.due_date && (
                            <div className={`mt-1.5 text-[10px] font-medium ${overdue ? "text-red-600" : "text-slate-500"}`}>
                              Due {new Date(t.due_date).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => confirm("Delete task?") && deleteMut.mutate(t.id)}
                          data-testid={`kanban-delete-${t.id}`}
                          className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-600 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <NewTaskDialog
        open={openNew}
        setOpen={setOpenNew}
        members={members}
        projectId={activeProject}
        onCreate={(payload) => createMut.mutate(payload)}
      />
    </div>
  );
}

function NewTaskDialog({ open, setOpen, members, projectId, onCreate }) {
  const [form, setForm] = useState({ title: "", description: "", status: "todo", priority: "medium", assignee_id: "", due_date: "" });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    if (!form.title.trim()) { toast.error("Title required"); return; }
    onCreate({
      project_id: projectId,
      title: form.title,
      description: form.description,
      status: form.status,
      priority: form.priority,
      assignee_id: form.assignee_id || null,
      due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
      tags: [],
    });
    setOpen(false);
    setForm({ title: "", description: "", status: "todo", priority: "medium", assignee_id: "", due_date: "" });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>New task</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>Title</Label><Input data-testid="new-task-title" value={form.title} onChange={(e) => set("title", e.target.value)} /></div>
          <div><Label>Description</Label><Textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger data-testid="new-task-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COLUMNS.map((c) => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => set("priority", v)}>
                <SelectTrigger data-testid="new-task-priority"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Assignee</Label>
              <Select value={form.assignee_id || "none"} onValueChange={(v) => set("assignee_id", v === "none" ? "" : v)}>
                <SelectTrigger data-testid="new-task-assignee"><SelectValue placeholder="Choose" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Unassigned —</SelectItem>
                  {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Due date</Label>
              <Input type="date" data-testid="new-task-due" value={form.due_date} onChange={(e) => set("due_date", e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button data-testid="new-task-submit" onClick={submit} className="bg-indigo-600 hover:bg-indigo-700">Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
