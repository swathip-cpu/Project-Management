import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useNavigate, useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import KanbanBoard from "@/components/app/KanbanBoard";
import FileList from "@/components/app/FileList";
import { ChevronLeft, MessageSquare, Upload, Trash2, Save } from "lucide-react";
import { toast } from "sonner";

const STATUS = [
  { key: "planning", label: "Planning" },
  { key: "in_progress", label: "In progress" },
  { key: "on_hold", label: "On hold" },
  { key: "completed", label: "Completed" },
  { key: "archived", label: "Archived" },
];
const statusCls = (s) => ({
  planning: "bg-slate-100 text-slate-700",
  in_progress: "bg-indigo-50 text-indigo-700",
  on_hold: "bg-amber-50 text-amber-700",
  completed: "bg-emerald-50 text-emerald-700",
  archived: "bg-slate-100 text-slate-500",
}[s] || "bg-slate-100 text-slate-700");

export default function ProjectDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: async () => (await api.get(`/projects/${id}`)).data,
  });
  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", id],
    queryFn: async () => (await api.get(`/tasks?project_id=${id}`)).data,
  });
  const { data: members = [] } = useQuery({
    queryKey: ["members"],
    queryFn: async () => (await api.get("/team")).data,
  });
  const { data: comments = [] } = useQuery({
    queryKey: ["comments", id],
    queryFn: async () => (await api.get(`/comments?project_id=${id}`)).data,
  });
  const { data: activity = [] } = useQuery({
    queryKey: ["activity", id],
    queryFn: async () => (await api.get(`/activity?project_id=${id}`)).data,
  });

  const [edit, setEdit] = useState(false);

  const progress = useMemo(() => {
    if (!tasks.length) return 0;
    return Math.round((tasks.filter((t) => t.status === "done").length / tasks.length) * 100);
  }, [tasks]);

  const updateMut = useMutation({
    mutationFn: async (payload) => (await api.put(`/projects/${id}`, payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", id] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project updated");
      setEdit(false);
    },
  });

  if (isLoading || !project) return <div className="text-sm text-slate-500">Loading…</div>;

  const lead = members.find((m) => m.id === project.lead_member_id);

  return (
    <div className="space-y-5 max-w-[1400px]">
      <button onClick={() => nav("/projects")} className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1" data-testid="project-back">
        <ChevronLeft className="w-3.5 h-3.5" /> Back to projects
      </button>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        {project.cover_url && (
          <div className="h-32 relative">
            <img src={project.cover_url} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
                <Badge className={`${statusCls(project.status)} border-transparent capitalize`}>
                  {project.status.replace("_", " ")}
                </Badge>
              </div>
              <p className="text-sm text-slate-500 mt-1 max-w-2xl">{project.description || "No description"}</p>
            </div>
            <div className="flex items-center gap-3">
              {lead && (
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <Avatar className="w-7 h-7"><AvatarImage src={lead.avatar_url} /><AvatarFallback>{lead.name.slice(0, 1)}</AvatarFallback></Avatar>
                  <span>Lead · {lead.name}</span>
                </div>
              )}
              <Button variant="outline" size="sm" onClick={() => setEdit(true)} data-testid="project-edit-button">Edit</Button>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-md border border-slate-200 p-4 bg-white">
              <div className="text-[11px] uppercase text-slate-500">Progress</div>
              <div className="mt-1 flex items-center gap-2">
                <Progress value={progress} className="h-1.5 flex-1" />
                <div className="text-sm font-semibold">{progress}%</div>
              </div>
            </div>
            <div className="rounded-md border border-slate-200 p-4 bg-white">
              <div className="text-[11px] uppercase text-slate-500">Tasks</div>
              <div className="mt-1 text-sm font-semibold">{tasks.filter((t) => t.status === "done").length}/{tasks.length} completed</div>
            </div>
            <div className="rounded-md border border-slate-200 p-4 bg-white">
              <div className="text-[11px] uppercase text-slate-500">Due date</div>
              <div className="mt-1 text-sm font-semibold">{project.due_date ? new Date(project.due_date).toLocaleDateString() : "—"}</div>
            </div>
          </div>
        </div>
      </Card>

      <Tabs defaultValue="tasks" className="w-full">
        <TabsList className="bg-white border border-slate-200">
          <TabsTrigger data-testid="project-detail-tab-overview" value="overview">Overview</TabsTrigger>
          <TabsTrigger data-testid="project-detail-tab-tasks" value="tasks">Tasks</TabsTrigger>
          <TabsTrigger data-testid="project-detail-tab-files" value="files">Files</TabsTrigger>
          <TabsTrigger data-testid="project-detail-tab-activity" value="activity">Activity</TabsTrigger>
          <TabsTrigger data-testid="project-detail-tab-comments" value="comments">Comments</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card className="p-6 border-slate-200 shadow-sm">
              <div className="text-base font-semibold">Milestones</div>
              {(project.milestones || []).length === 0 && (
                <div className="text-sm text-slate-500 mt-2">No milestones yet.</div>
              )}
              <ul className="mt-4 space-y-2">
                {(project.milestones || []).map((m, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <span className={`w-2 h-2 rounded-full ${m.done ? "bg-emerald-500" : "bg-slate-300"}`} />
                    <span className={m.done ? "line-through text-slate-400" : ""}>{m.title}</span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card className="p-6 border-slate-200 shadow-sm">
              <div className="text-base font-semibold">Team on this project</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(project.member_ids || []).map((mid) => {
                  const m = members.find((x) => x.id === mid);
                  if (!m) return null;
                  return (
                    <div key={mid} className="flex items-center gap-2 rounded-full border border-slate-200 pl-1 pr-3 py-1 bg-white">
                      <Avatar className="w-6 h-6"><AvatarImage src={m.avatar_url} /><AvatarFallback>{m.name.slice(0, 1)}</AvatarFallback></Avatar>
                      <span className="text-xs font-medium">{m.name}</span>
                      <span className="text-[10px] text-slate-400">{m.role}</span>
                    </div>
                  );
                })}
                {(project.member_ids || []).length === 0 && (
                  <div className="text-sm text-slate-500">No members assigned.</div>
                )}
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tasks" className="mt-5">
          <KanbanBoard projectId={id} members={members} />
        </TabsContent>

        <TabsContent value="files" className="mt-5">
          <FileList projectId={id} />
        </TabsContent>

        <TabsContent value="activity" className="mt-5">
          <Card className="p-6 border-slate-200 shadow-sm">
            {activity.length === 0 && <div className="text-sm text-slate-500">No activity yet.</div>}
            <ul className="space-y-3">
              {activity.map((a) => (
                <li key={a.id} className="flex items-start gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-indigo-500 mt-2" />
                  <div>
                    <div>{a.message}</div>
                    <div className="text-[11px] text-slate-400">{new Date(a.created_at).toLocaleString()}</div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </TabsContent>

        <TabsContent value="comments" className="mt-5">
          <CommentsPanel projectId={id} comments={comments} />
        </TabsContent>
      </Tabs>

      <EditProjectDialog
        open={edit}
        setOpen={setEdit}
        project={project}
        members={members}
        onSave={(payload) => updateMut.mutate(payload)}
      />
    </div>
  );
}

function CommentsPanel({ projectId, comments }) {
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const mut = useMutation({
    mutationFn: async () => (await api.post("/comments", { project_id: projectId, body })).data,
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: ["comments", projectId] });
      qc.invalidateQueries({ queryKey: ["activity", projectId] });
      toast.success("Comment posted");
    },
  });
  const del = useMutation({
    mutationFn: async (cid) => (await api.delete(`/comments/${cid}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comments", projectId] }),
  });

  return (
    <Card className="p-6 border-slate-200 shadow-sm">
      <div className="text-base font-semibold flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-indigo-600" /> Discussion
      </div>
      <div className="mt-4 space-y-3">
        {comments.length === 0 && <div className="text-sm text-slate-500">Be the first to comment.</div>}
        {comments.map((c) => (
          <div key={c.id} className="rounded-md border border-slate-200 p-3 bg-white">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium text-slate-700">{c.author}</div>
              <div className="flex items-center gap-3">
                <div className="text-[11px] text-slate-400">{new Date(c.created_at).toLocaleString()}</div>
                <button onClick={() => del.mutate(c.id)} className="text-slate-300 hover:text-red-600" data-testid={`delete-comment-${c.id}`}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="text-sm mt-1 whitespace-pre-wrap">{c.body}</div>
          </div>
        ))}
      </div>
      <div className="mt-5">
        <Textarea data-testid="comment-input" rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a comment…" />
        <div className="flex justify-end mt-2">
          <Button
            data-testid="comment-submit"
            onClick={() => body.trim() && mut.mutate()}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            Post
          </Button>
        </div>
      </div>
    </Card>
  );
}

function EditProjectDialog({ open, setOpen, project, members, onSave }) {
  const [form, setForm] = useState({});
  React.useEffect(() => {
    if (project) {
      setForm({
        name: project.name,
        description: project.description || "",
        status: project.status,
        lead_member_id: project.lead_member_id || "",
        member_ids: project.member_ids || [],
        milestones: project.milestones || [],
        due_date: project.due_date ? project.due_date.slice(0, 10) : "",
        cover_url: project.cover_url || "",
      });
    }
  }, [project, open]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const toggleMember = (mid) => {
    set("member_ids", form.member_ids.includes(mid) ? form.member_ids.filter((x) => x !== mid) : [...form.member_ids, mid]);
  };

  const submit = () => {
    onSave({
      name: form.name,
      description: form.description,
      status: form.status,
      lead_member_id: form.lead_member_id || null,
      member_ids: form.member_ids,
      milestones: form.milestones,
      due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
      cover_url: form.cover_url || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Edit project</DialogTitle></DialogHeader>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto thin-scroll pr-1">
          <div><Label>Name</Label><Input value={form.name || ""} onChange={(e) => set("name", e.target.value)} data-testid="edit-project-name" /></div>
          <div><Label>Description</Label><Textarea rows={3} value={form.description || ""} onChange={(e) => set("description", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger data-testid="edit-project-status"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Due date</Label>
              <Input type="date" value={form.due_date || ""} onChange={(e) => set("due_date", e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Lead</Label>
            <Select value={form.lead_member_id || "none"} onValueChange={(v) => set("lead_member_id", v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Choose lead" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None —</SelectItem>
                {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Team members</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {members.map((m) => {
                const active = (form.member_ids || []).includes(m.id);
                return (
                  <button key={m.id} type="button" onClick={() => toggleMember(m.id)} className={`text-xs px-2.5 py-1 rounded-full border ${active ? "bg-indigo-50 border-indigo-300 text-indigo-700" : "bg-white border-slate-200 text-slate-600"}`}>
                    {m.name}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <Label>Cover URL (optional)</Label>
            <Input value={form.cover_url || ""} onChange={(e) => set("cover_url", e.target.value)} placeholder="https://…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={submit} data-testid="edit-project-save"><Save className="w-4 h-4 mr-1.5" />Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
