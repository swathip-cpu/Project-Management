import React, { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import KanbanBoard from "@/components/app/KanbanBoard";
import { api } from "@/lib/api";

export default function Kanban() {
  const [params] = useSearchParams();
  const openNew = params.get("new") === "1";
  const { data: members = [] } = useQuery({
    queryKey: ["members"],
    queryFn: async () => (await api.get("/team")).data,
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tasks & Kanban</h1>
        <p className="text-sm text-slate-500 mt-1">Drag cards across columns to update status. Slack alerts fire automatically.</p>
      </div>
      <KanbanBoard members={members} showProjectPicker autoOpenNew={openNew} />
    </div>
  );
}
