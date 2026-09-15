import React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend, BarChart, Bar,
} from "recharts";
import { FolderKanban, CheckSquare, Users, TrendingUp } from "lucide-react";

const STATUS_COLORS = {
  planning: "#94A3B8",
  in_progress: "#4F46E5",
  on_hold: "#F59E0B",
  completed: "#10B981",
  archived: "#CBD5E1",
};

const KPI = ({ label, value, icon: Icon, tone = "indigo", testid }) => (
  <Card data-testid={testid} className="p-5 border-slate-200 shadow-sm bg-white">
    <div className="flex items-center justify-between">
      <div className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`w-8 h-8 rounded-md flex items-center justify-center bg-${tone}-50 text-${tone}-600`}>
        <Icon className="w-4 h-4" />
      </div>
    </div>
    <div className="mt-3 text-3xl font-semibold tracking-tight">{value}</div>
  </Card>
);

export default function Reports() {
  const { data, isLoading } = useQuery({
    queryKey: ["reports"],
    queryFn: async () => (await api.get("/reports/summary")).data,
  });

  if (isLoading || !data) return <div className="text-sm text-slate-500">Loading reports…</div>;

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reports & analytics</h1>
        <p className="text-sm text-slate-500 mt-1">A quick read on velocity, workload and project mix.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI testid="report-kpi-active" label="Active projects" value={data.kpis.active_projects} icon={FolderKanban} />
        <KPI testid="report-kpi-tasks" label="Total tasks" value={data.kpis.total_tasks} icon={CheckSquare} tone="orange" />
        <KPI testid="report-kpi-team" label="Team size" value={data.kpis.team_size} icon={Users} tone="sky" />
        <KPI testid="report-kpi-completion" label="Completion rate" value={`${data.kpis.completion_rate}%`} icon={TrendingUp} tone="emerald" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <Card className="xl:col-span-2 p-6 border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-base font-semibold">Tasks completed per week</div>
              <div className="text-xs text-slate-500">Last 8 weeks</div>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.weekly_completed}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4F46E5" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#4F46E5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="week" stroke="#94A3B8" fontSize={11} />
                <YAxis stroke="#94A3B8" fontSize={11} allowDecimals={false} />
                <Tooltip />
                <Area type="monotone" dataKey="completed" stroke="#4F46E5" fill="url(#grad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6 border-slate-200 shadow-sm">
          <div className="text-base font-semibold">Project status</div>
          <div className="text-xs text-slate-500">Distribution across statuses</div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.status_distribution} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={3}>
                  {data.status_distribution.map((entry, i) => (
                    <Cell key={i} fill={STATUS_COLORS[entry.name] || "#CBD5E1"} />
                  ))}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Card className="p-6 border-slate-200 shadow-sm">
          <div className="text-base font-semibold">Team workload</div>
          <div className="text-xs text-slate-500">Active (unfinished) tasks per member</div>
          <div className="h-72 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.workload}>
                <CartesianGrid stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} interval={0} angle={-15} textAnchor="end" height={60} />
                <YAxis stroke="#94A3B8" fontSize={11} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="active" fill="#4F46E5" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6 border-slate-200 shadow-sm">
          <div className="text-base font-semibold">Top projects</div>
          <div className="text-xs text-slate-500">Ranked by progress</div>
          <div className="mt-4 divide-y divide-slate-100">
            <div className="grid grid-cols-12 gap-2 text-[11px] uppercase text-slate-500 pb-2">
              <div className="col-span-6">Project</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Tasks</div>
              <div className="col-span-2 text-right">Progress</div>
            </div>
            {data.top_projects.map((p) => (
              <div key={p.id} className="grid grid-cols-12 gap-2 items-center py-3 text-sm">
                <div className="col-span-6 truncate font-medium">{p.name}</div>
                <div className="col-span-2"><Badge className="capitalize bg-slate-100 text-slate-700 border-transparent">{(p.status || "").replace("_", " ")}</Badge></div>
                <div className="col-span-2 text-slate-500 text-xs">{p.completed}/{p.total_tasks}</div>
                <div className="col-span-2 flex items-center gap-2 justify-end">
                  <Progress value={p.progress} className="h-1.5 w-20" />
                  <span className="text-xs text-slate-500 w-8 text-right">{p.progress}%</span>
                </div>
              </div>
            ))}
            {data.top_projects.length === 0 && <div className="text-sm text-slate-500 py-6 text-center">No projects yet.</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}
