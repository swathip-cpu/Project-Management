import React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { FolderKanban, CheckSquare, Users, TrendingUp, Clock, Activity as ActivityIcon } from "lucide-react";

const STATUS_STYLES = {
  planning: "bg-slate-100 text-slate-700",
  in_progress: "bg-indigo-50 text-indigo-700",
  on_hold: "bg-amber-50 text-amber-700",
  completed: "bg-emerald-50 text-emerald-700",
  archived: "bg-slate-100 text-slate-500",
};

const KPI = ({ label, value, sub, icon: Icon, testid, tone = "indigo" }) => (
  <Card data-testid={testid} className="p-5 border-slate-200 shadow-sm bg-white">
    <div className="flex items-center justify-between">
      <div className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`w-8 h-8 rounded-md flex items-center justify-center bg-${tone}-50 text-${tone}-600`}>
        <Icon className="w-4 h-4" />
      </div>
    </div>
    <div className="mt-3 text-3xl font-semibold tracking-tight">{value}</div>
    {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
  </Card>
);

const dayLabel = (n) => {
  if (n < 0) return `${Math.abs(n)}d overdue`;
  if (n === 0) return "Due today";
  if (n === 1) return "Due tomorrow";
  return `in ${n} days`;
};

export default function Dashboard() {
  const nav = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => (await api.get("/dashboard")).data,
  });

  if (isLoading) return <div className="text-sm text-slate-500">Loading dashboard…</div>;
  const d = data;

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">A live snapshot of your projects, deadlines and team.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI testid="stat-card-active-projects" label="Active projects" value={d.kpis.active_projects} icon={FolderKanban} tone="indigo" />
        <KPI testid="stat-card-tasks-due" label="Tasks due" value={d.kpis.tasks_due} icon={CheckSquare} tone="orange" sub="Open tasks with a due date" />
        <KPI testid="stat-card-team-size" label="Team size" value={d.kpis.team_size} icon={Users} tone="sky" />
        <KPI testid="stat-card-completion-rate" label="Completion rate" value={`${d.kpis.completion_rate}%`} icon={TrendingUp} tone="emerald" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2 p-6 border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-base font-semibold">Recent projects</div>
              <div className="text-xs text-slate-500">Click to open the project workspace</div>
            </div>
            <button
              data-testid="dashboard-view-all-projects"
              onClick={() => nav("/projects")}
              className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
            >
              View all →
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {d.recent_projects.length === 0 && (
              <div className="text-sm text-slate-500 py-6 text-center">No projects yet. Create one to get started.</div>
            )}
            {d.recent_projects.map((p) => (
              <button
                key={p.id}
                data-testid={`dashboard-project-${p.id}`}
                onClick={() => nav(`/projects/${p.id}`)}
                className="w-full text-left py-4 grid grid-cols-12 gap-4 items-center hover:bg-slate-50 rounded-md px-2 -mx-2"
              >
                <div className="col-span-5 min-w-0">
                  <div className="font-medium text-sm truncate">{p.name}</div>
                  <div className="text-xs text-slate-500 line-clamp-1 mt-0.5">{p.description || "No description"}</div>
                </div>
                <div className="col-span-2">
                  <Badge className={`${STATUS_STYLES[p.status] || "bg-slate-100 text-slate-700"} border-transparent capitalize`}>
                    {p.status.replace("_", " ")}
                  </Badge>
                </div>
                <div className="col-span-3">
                  <div className="flex items-center gap-2">
                    <Progress value={p.progress} className="h-1.5 flex-1" />
                    <div className="text-xs text-slate-500 w-8 text-right">{p.progress}%</div>
                  </div>
                </div>
                <div className="col-span-2 text-right text-xs text-slate-500">
                  {p.completed_count}/{p.task_count} tasks
                </div>
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-6 border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-indigo-600" />
            <div className="text-base font-semibold">Upcoming deadlines</div>
          </div>
          <div className="space-y-3 max-h-[420px] overflow-y-auto thin-scroll pr-1">
            {d.upcoming_deadlines.length === 0 && (
              <div className="text-sm text-slate-500 text-center py-6">Nothing pressing. Nice work.</div>
            )}
            {d.upcoming_deadlines.map((t) => {
              const overdue = t.days_left < 0;
              return (
                <div
                  key={t.id}
                  className={`p-3 rounded-md border ${overdue ? "border-red-200 bg-red-50" : "border-slate-200 bg-white"}`}
                >
                  <div className="text-sm font-medium truncate">{t.title}</div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[11px] font-medium capitalize text-slate-600">
                      {t.priority} · {t.status.replace("_", " ")}
                    </span>
                    <span className={`text-[11px] font-medium ${overdue ? "text-red-700" : "text-slate-500"}`}>
                      {dayLabel(t.days_left)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card className="p-6 border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <ActivityIcon className="w-4 h-4 text-indigo-600" />
          <div className="text-base font-semibold">Recent activity</div>
        </div>
        <ul className="space-y-3">
          {d.recent_activity.length === 0 && (
            <li className="text-sm text-slate-500">No activity yet.</li>
          )}
          {d.recent_activity.map((a) => (
            <li key={a.id} className="flex items-start gap-3 text-sm">
              <div className="w-2 h-2 rounded-full bg-indigo-500 mt-2" />
              <div className="flex-1">
                <div>{a.message}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {new Date(a.created_at).toLocaleString()}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
