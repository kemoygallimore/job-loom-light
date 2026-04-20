import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Briefcase, Calendar } from "lucide-react";
import { toast } from "sonner";

interface ResumeFile {
  id: string;
  bucket: string;
  file_key: string;
  file_name: string;
  file_size: number;
  uploaded_at: string;
  job_id: string | null;
  job_title: string | null;
}

function formatBytes(bytes: number) {
  if (!bytes) return "—";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

export default function ResumeHistory({ candidateId }: { candidateId: string }) {
  const [files, setFiles] = useState<ResumeFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("candidate_files")
        .select("id, bucket, file_key, file_name, file_size, uploaded_at, job_id, jobs(title)")
        .eq("candidate_id", candidateId)
        .eq("category", "resume")
        .order("uploaded_at", { ascending: false });

      if (error) {
        console.error(error);
        toast.error("Failed to load resume history");
        setLoading(false);
        return;
      }

      setFiles(
        (data ?? []).map((f: any) => ({
          id: f.id,
          bucket: f.bucket,
          file_key: f.file_key,
          file_name: f.file_name,
          file_size: f.file_size,
          uploaded_at: f.uploaded_at,
          job_id: f.job_id,
          job_title: f.jobs?.title ?? null,
        })),
      );
      setLoading(false);
    };
    load();
  }, [candidateId]);

  const handleDownload = async (file: ResumeFile) => {
    setDownloadingId(file.id);
    try {
      const res = await fetch("https://api.rizonhire.com/sign-view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bucket: file.bucket, key: file.file_key }),
      });
      if (!res.ok) throw new Error("Failed to get signed URL");
      const data = await res.json();
      if (!data.viewUrl) throw new Error("Invalid response");
      window.open(data.viewUrl, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to download resume");
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        No resume versions on file yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {files.map((f, idx) => {
        const isLatest = idx === 0;
        return (
          <div
            key={f.id}
            className={`flex items-center gap-3 p-3 rounded-lg border ${
              isLatest ? "bg-primary/5 border-primary/20" : "bg-muted/30"
            }`}
          >
            <div
              className={`w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0 ${
                isLatest ? "bg-primary/10" : "bg-muted"
              }`}
            >
              <FileText
                className={`w-4 h-4 ${isLatest ? "text-primary" : "text-muted-foreground"}`}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium truncate">{f.file_name}</span>
                {isLatest && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    Current
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <Briefcase className="w-3 h-3" />
                  {f.job_title ?? "Manual upload"}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(f.uploaded_at).toLocaleDateString()}
                </span>
                <span className="tabular-nums">{formatBytes(f.file_size)}</span>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 flex-shrink-0"
              disabled={downloadingId === f.id}
              onClick={() => handleDownload(f)}
            >
              <Download className="w-3.5 h-3.5" />
              {downloadingId === f.id ? "Loading…" : "View"}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
