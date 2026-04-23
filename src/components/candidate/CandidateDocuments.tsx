import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { uploadToStorage } from "@/lib/uploadToStorage";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Download, Calendar, Upload, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface CandidateDocument {
  id: string;
  bucket: string;
  file_key: string;
  file_name: string;
  file_type: string;
  file_size: number;
  uploaded_at: string;
}

function formatBytes(bytes: number) {
  if (!bytes) return "—";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

interface Props {
  candidateId: string;
  companyId: string;
}

export default function CandidateDocuments({ candidateId, companyId }: Props) {
  const { profile } = useAuth();
  const [files, setFiles] = useState<CandidateDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("candidate_files")
      .select("id, bucket, file_key, file_name, file_type, file_size, uploaded_at")
      .eq("candidate_id", candidateId)
      .eq("category", "document")
      .order("uploaded_at", { ascending: false });

    if (error) {
      console.error(error);
      toast.error("Failed to load documents");
      setLoading(false);
      return;
    }
    setFiles((data ?? []) as CandidateDocument[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateId]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!profile) {
      toast.error("You must be signed in");
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      toast.error("File is too large (max 25 MB)");
      e.target.value = "";
      return;
    }

    setUploading(true);
    try {
      const result = await uploadToStorage({
        file,
        companyId,
        jobId: "manual",
        candidateId,
        category: "document",
      });

      const { error } = await supabase.from("candidate_files").insert({
        company_id: companyId,
        job_id: null,
        candidate_id: candidateId,
        category: "document",
        bucket: result.bucket,
        file_key: result.key,
        file_name: result.fileName,
        file_type: result.fileType,
        file_size: result.fileSize,
      });
      if (error) throw new Error(error.message);

      toast.success("Document uploaded");
      await load();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleView = async (file: CandidateDocument) => {
    setBusyId(file.id);
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
      toast.error(err?.message || "Failed to open document");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (file: CandidateDocument) => {
    if (!confirm(`Delete "${file.file_name}"? This cannot be undone.`)) return;
    setBusyId(file.id);
    const { error } = await supabase.from("candidate_files").delete().eq("id", file.id);
    setBusyId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Document deleted");
    setFiles((prev) => prev.filter((f) => f.id !== file.id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium">Additional documents</h3>
          <p className="text-xs text-muted-foreground">
            Personal docs, application forms, references, etc. (max 25&nbsp;MB)
          </p>
        </div>
        <div>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={handleFileChange}
            disabled={uploading}
          />
          <Button
            size="sm"
            className="gap-2"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="w-4 h-4" />
            {uploading ? "Uploading…" : "Upload document"}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : files.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          No documents uploaded yet.
        </div>
      ) : (
        <div className="space-y-2">
          {files.map((f) => (
            <div
              key={f.id}
              className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30"
            >
              <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{f.file_name}</div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(f.uploaded_at).toLocaleDateString()}
                  </span>
                  <span className="tabular-nums">{formatBytes(f.file_size)}</span>
                  {f.file_type && (
                    <span className="truncate max-w-[160px]">{f.file_type}</span>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 flex-shrink-0"
                disabled={busyId === f.id}
                onClick={() => handleView(f)}
              >
                <Download className="w-3.5 h-3.5" />
                View
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="flex-shrink-0 text-muted-foreground hover:text-destructive"
                disabled={busyId === f.id}
                onClick={() => handleDelete(f)}
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}