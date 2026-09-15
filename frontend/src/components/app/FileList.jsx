import React, { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, fileDownloadUrl } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Image as ImageIcon, FileArchive, Trash2, Download } from "lucide-react";
import { toast } from "sonner";

const iconFor = (ext) => {
  const e = (ext || "").toLowerCase();
  if (["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(e)) return ImageIcon;
  if (["zip", "tar", "gz", "rar"].includes(e)) return FileArchive;
  return FileText;
};

const fmt = (n) => {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0; let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
};

export default function FileList({ projectId = null, standalone = false }) {
  const qc = useQueryClient();
  const inputRef = useRef();
  const [uploading, setUploading] = useState(false);

  const { data: files = [] } = useQuery({
    queryKey: ["files", projectId || "all"],
    queryFn: async () => (await api.get(projectId ? `/files?project_id=${projectId}` : "/files")).data,
  });

  const del = useMutation({
    mutationFn: async (id) => (await api.delete(`/files/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["files", projectId || "all"] }),
  });

  const onFiles = async (fileList) => {
    if (!fileList || !fileList.length) return;
    setUploading(true);
    try {
      for (const f of fileList) {
        const fd = new FormData();
        fd.append("file", f);
        if (projectId) fd.append("project_id", projectId);
        await api.post("/files/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      }
      qc.invalidateQueries({ queryKey: ["files", projectId || "all"] });
      qc.invalidateQueries({ queryKey: ["activity", projectId] });
      toast.success("Uploaded");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <Card className="p-6 border-slate-200 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-base font-semibold">Files & attachments</div>
          <div className="text-xs text-slate-500 mt-0.5">Store any file. Everything is scoped to this workspace.</div>
        </div>
        <div>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            data-testid="file-upload-input"
            onChange={(e) => onFiles(e.target.files)}
          />
          <Button onClick={() => inputRef.current?.click()} disabled={uploading} className="bg-indigo-600 hover:bg-indigo-700" data-testid="file-upload-button">
            <Upload className="w-4 h-4 mr-1.5" /> {uploading ? "Uploading…" : "Upload"}
          </Button>
        </div>
      </div>

      <div className="mt-5 divide-y divide-slate-100 border-t border-slate-100">
        {files.length === 0 && <div className="text-sm text-slate-500 py-8 text-center">No files yet.</div>}
        {files.map((f) => {
          const Icon = iconFor(f.extension);
          return (
            <div key={f.id} className="py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{f.original_filename}</div>
                <div className="text-[11px] text-slate-500">
                  {fmt(f.size)} · Uploaded by {f.uploaded_by} · {new Date(f.created_at).toLocaleString()}
                </div>
              </div>
              <a
                href={fileDownloadUrl(f.id)}
                target="_blank"
                rel="noreferrer"
                className="text-slate-500 hover:text-indigo-600 text-xs flex items-center gap-1"
                data-testid={`file-download-${f.id}`}
              >
                <Download className="w-3.5 h-3.5" /> Open
              </a>
              <button
                onClick={() => confirm("Delete this file?") && del.mutate(f.id)}
                className="ml-3 text-slate-300 hover:text-red-600"
                data-testid={`file-delete-${f.id}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
