import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Users,
  FileText,
  BarChart3,
  Bell,
  Settings as SettingsIcon,
  LogOut,
  Search,
  Plus,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const NAV = [
  { name: "Dashboard", to: "/", icon: LayoutDashboard, end: true, testid: "sidebar-link-dashboard" },
  { name: "Projects", to: "/projects", icon: FolderKanban, testid: "sidebar-link-projects" },
  { name: "Kanban", to: "/kanban", icon: CheckSquare, testid: "sidebar-link-kanban" },
  { name: "Team", to: "/team", icon: Users, testid: "sidebar-link-team" },
  { name: "Files", to: "/files", icon: FileText, testid: "sidebar-link-files" },
  { name: "Reports", to: "/reports", icon: BarChart3, testid: "sidebar-link-reports" },
  { name: "Notifications", to: "/notifications", icon: Bell, testid: "sidebar-link-notifications" },
  { name: "Settings", to: "/settings", icon: SettingsIcon, testid: "sidebar-link-settings" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  const { data: notifs = [] } = useQuery({
    queryKey: ["notifications-count"],
    queryFn: async () => (await api.get("/notifications")).data,
    refetchInterval: 20000,
  });
  const unread = notifs.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen flex bg-[#FAFBFD] text-slate-900">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 border-r border-slate-200 bg-white flex flex-col sticky top-0 h-screen">
        <div className="px-5 py-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold">
              P
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight">ProjectHub</div>
              <div className="text-[11px] text-slate-500 -mt-0.5">Manager workspace</div>
            </div>
          </div>
        </div>
        <nav className="p-3 flex-1 thin-scroll overflow-y-auto">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              data-testid={n.testid}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm mb-0.5 transition-colors ${
                  isActive
                    ? "bg-indigo-50 text-indigo-700 font-medium"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`
              }
            >
              <n.icon className="w-4 h-4" />
              <span className="flex-1">{n.name}</span>
              {n.name === "Notifications" && unread > 0 && (
                <span
                  data-testid="sidebar-unread-badge"
                  className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-indigo-600 text-white text-[10px] font-semibold"
                >
                  {unread}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-100">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                data-testid="user-menu-trigger"
                className="w-full flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-slate-50 text-left"
              >
                <Avatar className="w-8 h-8">
                  <AvatarImage src={user?.avatar_url} />
                  <AvatarFallback>{(user?.name || "M").slice(0, 1)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{user?.name}</div>
                  <div className="text-[11px] text-slate-500 truncate">{user?.email}</div>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-56">
              <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => nav("/settings")} data-testid="user-menu-settings">
                <SettingsIcon className="w-4 h-4 mr-2" /> Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={logout} data-testid="user-menu-logout">
                <LogOut className="w-4 h-4 mr-2" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 h-14 bg-white/80 backdrop-blur border-b border-slate-200 flex items-center gap-3 px-6">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              data-testid="header-search-input"
              placeholder="Search projects, tasks, members…"
              className="pl-9 h-9 bg-slate-50 border-slate-200"
            />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button
              data-testid="quick-add-project-button"
              variant="outline"
              size="sm"
              onClick={() => nav("/projects?new=1")}
              className="h-9"
            >
              <Plus className="w-4 h-4 mr-1.5" /> Project
            </Button>
            <Button
              data-testid="quick-add-task-button"
              size="sm"
              onClick={() => nav("/kanban?new=1")}
              className="h-9 bg-indigo-600 hover:bg-indigo-700"
            >
              <Plus className="w-4 h-4 mr-1.5" /> Task
            </Button>
          </div>
        </header>
        <main className="flex-1 p-6 fade-in-up">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
