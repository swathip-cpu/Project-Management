import React, { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";

const TABS = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "success", label: "Completed" },
  { key: "info", label: "Info" },
];

export default function Notifications() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("all");

  const { data: notifs = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => (await api.get("/notifications")).data,
  });

  const filtered = useMemo(() => {
    if (tab === "all") return notifs;
    if (tab === "unread") return notifs.filter((n) => !n.read);
    return notifs.filter((n) => n.kind === tab);
  }, [notifs, tab]);

  const readMut = useMutation({
    mutationFn: async (id) => (await api.post(`/notifications/${id}/read`)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["notifications"] }); qc.invalidateQueries({ queryKey: ["notifications-count"] }); },
  });
  const readAll = useMutation({
    mutationFn: async () => (await api.post("/notifications/read-all")).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["notifications"] }); qc.invalidateQueries({ queryKey: ["notifications-count"] }); toast.success("All marked read"); },
  });
  const del = useMutation({
    mutationFn: async (id) => (await api.delete(`/notifications/${id}`)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["notifications"] }); qc.invalidateQueries({ queryKey: ["notifications-count"] }); },
  });

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2"><Bell className="w-5 h-5 text-indigo-600" /> Notifications</h1>
          <p className="text-sm text-slate-500 mt-1">In-app alerts for every important thing that happens.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => readAll.mutate()} data-testid="notifications-read-all">Mark all read</Button>
      </div>

      <div className="inline-flex rounded-md border border-slate-200 p-0.5 bg-white">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            data-testid={`notifications-tab-${t.key}`}
            className={`px-3 py-1.5 text-xs font-medium rounded-[5px] ${tab === t.key ? "bg-slate-100 text-slate-900" : "text-slate-500"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Card className="border-slate-200 shadow-sm divide-y divide-slate-100">
        {filtered.length === 0 && <div className="p-10 text-sm text-slate-500 text-center">Nothing here yet.</div>}
        {filtered.map((n) => (
          <div key={n.id} className={`p-4 flex items-start gap-3 ${n.read ? "" : "bg-indigo-50/40"}`} data-testid={`notification-${n.id}`}>
            <div className={`w-2 h-2 rounded-full mt-2 ${n.read ? "bg-slate-300" : "bg-indigo-500"}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="text-sm font-medium">{n.title}</div>
                {!n.read && <Badge className="bg-indigo-50 text-indigo-700 border-transparent">New</Badge>}
              </div>
              <div className="text-sm text-slate-600 mt-0.5">{n.message}</div>
              <div className="text-[11px] text-slate-400 mt-1">{new Date(n.created_at).toLocaleString()}</div>
            </div>
            {!n.read && (
              <button onClick={() => readMut.mutate(n.id)} className="p-1.5 rounded hover:bg-slate-100 text-slate-500" data-testid={`notification-read-${n.id}`}>
                <Check className="w-4 h-4" />
              </button>
            )}
            <button onClick={() => del.mutate(n.id)} className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600" data-testid={`notification-delete-${n.id}`}>
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </Card>
    </div>
  );
}
