import React, { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/context/AuthContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Slack, Save, Send } from "lucide-react";
import { toast } from "sonner";

const EVENTS = [
  { key: "task_created", label: "Task created" },
  { key: "task_assigned", label: "Task assigned" },
  { key: "task_completed", label: "Task marked complete" },
  { key: "deadline_approaching", label: "Deadline approaching (24h before)" },
  { key: "new_comment", label: "New comment on project" },
  { key: "project_status_change", label: "Project status change" },
];

export default function Settings() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await api.get("/settings")).data,
  });
  const [form, setForm] = useState({ slack_webhook_url: "", slack_events: {} });
  useEffect(() => {
    if (settings) setForm({ slack_webhook_url: settings.slack_webhook_url || "", slack_events: settings.slack_events || {} });
  }, [settings]);

  const saveMut = useMutation({
    mutationFn: async () => (await api.put("/settings", form)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["settings"] }); toast.success("Settings saved"); },
  });
  const testMut = useMutation({
    mutationFn: async () => (await api.post("/settings/test-slack")).data,
    onSuccess: () => toast.success("Test alert sent to Slack"),
    onError: (e) => toast.error(e?.response?.data?.detail || "Slack test failed"),
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Manage your workspace, profile and integrations.</p>
      </div>

      <Card className="p-6 border-slate-200 shadow-sm">
        <div className="text-base font-semibold">Profile</div>
        <div className="mt-4 flex items-center gap-4">
          <Avatar className="w-14 h-14"><AvatarImage src={user?.avatar_url} /><AvatarFallback>{(user?.name || "M").slice(0, 1)}</AvatarFallback></Avatar>
          <div>
            <div className="font-medium">{user?.name}</div>
            <div className="text-xs text-slate-500">{user?.email}</div>
            <div className="text-[11px] text-slate-400 mt-0.5 capitalize">{user?.role}</div>
          </div>
        </div>
      </Card>

      <Card className="p-6 border-slate-200 shadow-sm">
        <div className="flex items-center gap-2">
          <Slack className="w-5 h-5 text-indigo-600" />
          <div className="text-base font-semibold">Slack integration</div>
        </div>
        <p className="text-xs text-slate-500 mt-1">Paste your Incoming Webhook URL. We'll post alerts for the selected events.</p>

        <div className="mt-5 space-y-4">
          <div>
            <Label>Webhook URL</Label>
            <Input
              data-testid="slack-webhook-url-input"
              value={form.slack_webhook_url}
              onChange={(e) => setForm((f) => ({ ...f, slack_webhook_url: e.target.value }))}
              placeholder="https://hooks.slack.com/services/…"
            />
            <div className="text-[11px] text-slate-400 mt-1">
              Get a webhook URL at{" "}
              <a href="https://api.slack.com/messaging/webhooks" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
                api.slack.com/messaging/webhooks
              </a>.
            </div>
          </div>

          <div>
            <div className="text-sm font-medium mb-2">Alert triggers</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {EVENTS.map((e) => (
                <label key={e.key} className="flex items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-2 bg-white">
                  <span className="text-sm">{e.label}</span>
                  <Switch
                    checked={!!form.slack_events?.[e.key]}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, slack_events: { ...f.slack_events, [e.key]: v } }))}
                    data-testid={`slack-event-${e.key}`}
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button onClick={() => saveMut.mutate()} className="bg-indigo-600 hover:bg-indigo-700" data-testid="settings-save">
              <Save className="w-4 h-4 mr-1.5" /> Save
            </Button>
            <Button
              variant="outline"
              onClick={() => testMut.mutate()}
              disabled={!form.slack_webhook_url}
              data-testid="test-slack-alert-button"
            >
              <Send className="w-4 h-4 mr-1.5" /> Send test alert
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
