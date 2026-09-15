import React, { useMemo, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Search, LayoutGrid, List, Archive } from "lucide-react";
import { toast } from "sonner";

const STATUS = [
  { key: "planning", label: "Planning", cls: "bg-slate-100 text-slate-700" },
  { key: "in_progress", label: "In progress", cls: "bg-indigo-50 text-indigo-700" },
  { key: "on_hold", label: "On hold", cls: "bg-amber-50 text-amber-700" },
  { key: "completed", label: "Completed", cls: "bg-emerald-50 text-emerald-700" },
  { key: "archived", label: "Archived", cls: "bg-slate-100 text-slate-500" },
];
const statusCls = (s) => STATUS.find((x) => x.key === s)?.cls || "bg-slate-100 text-slate-700";
const statusLabel = (s) => STATUS.find((x) => x.key === s)?.label || s;

export default function Projects() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState("grid");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [openNew, setOpenNew] = useState(params.get("new") === "1");
  const qc = useQueryClient();

  useEffect(() => {
    if (params.get("new") === "1") setOpenNew(true);
  }, [params]);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => (await api.get("/projects")).data,
  });
  const { data: members = [] } = useQuery({
    queryKey: ["members"],
    queryFn: async () => (await api.get("/team")).data,
  });

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (search && !`${p.name} ${p.description || ""}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [projects, search, statusFilter]);

  const createMut = useMutation({
    mutationFn: async (payload) => (await api.post("/projects", payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Project created");
    },
    onError: (e) => toast.error(e?.response?.data?.detail || "Create failed"),
  });

  const archiveMut = useMutation({
    mutationFn: async (id) => (await api.delete(`/projects/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project archived");
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-slate-500 mt-1">Every initiative you own — status, progress and next steps.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border border-slate-200 p-0.5 bg-white">
            <button
              data-testid="projects-view-grid"
              onClick={() => setView("grid")}
              className={`px-2.5 py-1.5 rounded-[5px] text-xs font-medium flex items-center gap-1 ${view === "grid" ? "bg-slate-100 text-slate-900" : "text-slate-500"}`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Grid
            </button>
            <button
              data-testid="projects-view-list"
              onClick={() => setView("list")}
              className={`px-2.5 py-1.5 rounded-[5px] text-xs font-medium flex items-center gap-1 ${view === "list" ? "bg-slate-100 text-slate-900" : "text-slate-500"}`}
            >
              <List className="w-3.5 h-3.5" /> List
            </button>
          </div>
          <NewProjectDialog open={openNew} setOpen={(v) => { setOpenNew(v); if (!v) { params.delete("new"); setParams(params); } }} members={members} onCreate={(p) => createMut.mutate(p)} />
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            data-testid="projects-search"
            placeholder="Search projects…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[170px]" data-testid="projects-status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS.map((s) => (
              <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {view === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <Card
              key={p.id}
              data-testid={`project-card-${p.id}`}
              onClick={() => nav(`/projects/${p.id}`)}
              className="p-0 border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition cursor-pointer overflow-hidden bg-white"
            >
              {p.cover_url ? (
                <div className="h-28 bg-slate-100 relative">
                  <img src={p.cover_url} alt="" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="h-28 bg-gradient-to-br from-indigo-500 to-indigo-700" />
              )}
              <div className="p-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium truncate">{p.name}</div>
                  <Badge className={`${statusCls(p.status)} border-transparent capitalize`}>{statusLabel(p.status)}</Badge>
                </div>
                <div className="text-xs text-slate-500 mt-1 line-clamp-2 min-h-[32px]">{p.description || "No description"}</div>
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                    <span>{p.completed_count}/{p.task_count} tasks</span>
                    <span>{p.progress}%</span>
                  </div>
                  <Progress value={p.progress} className="h-1.5" />
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex -space-x-2">
                    {(p.member_ids || []).slice(0, 4).map((mid) => {
                      const m = members.find((x) => x.id === mid);
                      if (!m) return null;
                      return (
                        <Avatar key={mid} className="w-7 h-7 ring-2 ring-white">
                          <AvatarImage src={m.avatar_url} />
                          <AvatarFallback>{m.name.slice(0, 1)}</AvatarFallback>
                        </Avatar>
                      );
                    })}
                  </div>
                  <button
                    data-testid={`project-archive-${p.id}`}
                    onClick={(e) => { e.stopPropagation(); if (confirm("Archive this project?")) archiveMut.mutate(p.id); }}
                    className="text-[11px] text-slate-400 hover:text-red-600 flex items-center gap-1"
                  >
                    <Archive className="w-3.5 h-3.5" /> Archive
                  </button>
                </div>
              </div>
            </Card>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-sm text-slate-500 text-center py-12">No projects match your filters.</div>
          )}
        </div>
      ) : (
        <Card className="border-slate-200 shadow-sm">
          <div className="divide-y divide-slate-100">
            <div className="grid grid-cols-12 gap-3 px-5 py-3 text-[11px] uppercase tracking-wider text-slate-500 font-medium">
              <div className="col-span-5">Project</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-3">Progress</div>
              <div className="col-span-2 text-right">Team</div>
            </div>
            {filtered.map((p) => (
              <button
                key={p.id}
                data-testid={`project-row-${p.id}`}
                onClick={() => nav(`/projects/${p.id}`)}
                className="w-full text-left grid grid-cols-12 gap-3 px-5 py-4 items-center hover:bg-slate-50"
              >
                <div className="col-span-5 min-w-0">
                  <div className="font-medium text-sm truncate">{p.name}</div>
                  <div className="text-xs text-slate-500 truncate">{p.description}</div>
                </div>
                <div className="col-span-2"><Badge className={`${statusCls(p.status)} border-transparent capitalize`}>{statusLabel(p.status)}</Badge></div>
                <div className="col-span-3 flex items-center gap-2"><Progress value={p.progress} className="h-1.5 flex-1" /><span className="text-xs text-slate-500 w-8 text-right">{p.progress}%</span></div>
                <div className="col-span-2 flex justify-end -space-x-2">
                  {(p.member_ids || []).slice(0, 4).map((mid) => {
                    const m = members.find((x) => x.id === mid);
                    if (!m) return null;
                    return (
                      <Avatar key={mid} className="w-6 h-6 ring-2 ring-white">
                        <AvatarImage src={m.avatar_url} />
                        <AvatarFallback>{m.name.slice(0, 1)}</AvatarFallback>
                      </Avatar>
                    );
                  })}
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function NewProjectDialog({ open, setOpen, members, onCreate }) {
  const [form, setForm] = useState({
    name: "", description: "", status: "planning", lead_member_id: "", member_ids: [], due_date: "",
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    onCreate({
      ...form,
      due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
      lead_member_id: form.lead_member_id || null,
      milestones: [],
    });
    setOpen(false);
    setForm({ name: "", description: "", status: "planning", lead_member_id: "", member_ids: [], due_date: "" });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="new-project-button" className="bg-indigo-600 hover:bg-indigo-700">
          <Plus className="w-4 h-4 mr-1.5" /> New project
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create project</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input data-testid="new-project-name" value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea data-testid="new-project-description" rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger data-testid="new-project-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS.filter((s) => s.key !== "archived").map((s) => (
                    <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Lead</Label>
              <Select value={form.lead_member_id || "none"} onValueChange={(v) => set("lead_member_id", v === "none" ? "" : v)}>
                <SelectTrigger data-testid="new-project-lead"><SelectValue placeholder="Choose lead" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Due date</Label>
            <Input type="date" data-testid="new-project-due" value={form.due_date} onChange={(e) => set("due_date", e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button data-testid="new-project-submit" onClick={submit} className="bg-indigo-600 hover:bg-indigo-700">Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
