import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, Mail } from "lucide-react";
import { toast } from "sonner";

export default function Team() {
  const qc = useQueryClient();
  const { data: members = [] } = useQuery({
    queryKey: ["members"],
    queryFn: async () => (await api.get("/team")).data,
  });
  const [openNew, setOpenNew] = useState(false);
  const [editing, setEditing] = useState(null);

  const createMut = useMutation({
    mutationFn: async (payload) => (await api.post("/team", payload)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["members"] }); toast.success("Member added"); },
  });
  const updateMut = useMutation({
    mutationFn: async ({ id, payload }) => (await api.put(`/team/${id}`, payload)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["members"] }); toast.success("Member updated"); },
  });
  const delMut = useMutation({
    mutationFn: async (id) => (await api.delete(`/team/${id}`)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["members"] }); toast.success("Removed"); },
  });

  const maxActive = Math.max(1, ...members.map((m) => m.active_tasks || 0));

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
          <p className="text-sm text-slate-500 mt-1">People you manage, plus their current workload.</p>
        </div>
        <Button onClick={() => setOpenNew(true)} className="bg-indigo-600 hover:bg-indigo-700" data-testid="team-add-button">
          <Plus className="w-4 h-4 mr-1.5" /> Add member
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {members.map((m) => {
          const load = Math.round(((m.active_tasks || 0) / maxActive) * 100);
          return (
            <Card key={m.id} className="p-5 border-slate-200 shadow-sm bg-white" data-testid={`team-card-${m.id}`}>
              <div className="flex items-center gap-3">
                <Avatar className="w-11 h-11"><AvatarImage src={m.avatar_url} /><AvatarFallback>{m.name.slice(0, 1)}</AvatarFallback></Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{m.name}</div>
                  <div className="text-xs text-slate-500">{m.role}</div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setEditing(m)} className="p-1.5 rounded hover:bg-slate-100 text-slate-500" data-testid={`team-edit-${m.id}`}><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => confirm("Remove member?") && delMut.mutate(m.id)} className="p-1.5 rounded hover:bg-red-50 text-slate-500 hover:text-red-600" data-testid={`team-delete-${m.id}`}><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <div className="mt-4 text-xs text-slate-600 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" /> {m.email}
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                  <span>Workload</span>
                  <span>{m.active_tasks || 0} active tasks</span>
                </div>
                <Progress value={load} className="h-1.5" />
              </div>
            </Card>
          );
        })}
        {members.length === 0 && <div className="col-span-full text-sm text-slate-500 text-center py-10">No members yet.</div>}
      </div>

      <MemberDialog
        open={openNew}
        setOpen={setOpenNew}
        onSubmit={(payload) => { createMut.mutate(payload); setOpenNew(false); }}
        title="Add member"
      />
      <MemberDialog
        open={!!editing}
        setOpen={(v) => !v && setEditing(null)}
        initial={editing}
        onSubmit={(payload) => { updateMut.mutate({ id: editing.id, payload }); setEditing(null); }}
        title="Edit member"
      />
    </div>
  );
}

function MemberDialog({ open, setOpen, onSubmit, initial, title }) {
  const [form, setForm] = useState({ name: "", email: "", role: "", avatar_url: "" });
  React.useEffect(() => {
    if (initial) setForm({ name: initial.name, email: initial.email, role: initial.role, avatar_url: initial.avatar_url || "" });
    else if (open) setForm({ name: "", email: "", role: "", avatar_url: "" });
  }, [initial, open]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const submit = () => {
    if (!form.name || !form.email) { toast.error("Name and email required"); return; }
    onSubmit(form);
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={form.name} data-testid="member-name" onChange={(e) => set("name", e.target.value)} /></div>
          <div><Label>Email</Label><Input type="email" value={form.email} data-testid="member-email" onChange={(e) => set("email", e.target.value)} /></div>
          <div><Label>Role</Label><Input value={form.role} data-testid="member-role" onChange={(e) => set("role", e.target.value)} placeholder="Engineer, Designer…" /></div>
          <div><Label>Avatar URL (optional)</Label><Input value={form.avatar_url} onChange={(e) => set("avatar_url", e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} className="bg-indigo-600 hover:bg-indigo-700" data-testid="member-submit">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
