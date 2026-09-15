import React from "react";
import FileList from "@/components/app/FileList";

export default function Files() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Files library</h1>
        <p className="text-sm text-slate-500 mt-1">All uploaded assets across your workspace.</p>
      </div>
      <FileList standalone />
    </div>
  );
}
