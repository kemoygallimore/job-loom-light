import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileDown, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import PageHeader from "@/components/shared/PageHeader";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { deleteExportFile, exportTypeLabel, getExportDownloadUrl, type ExportJob, type ExportStatus } from "@/lib/exportJobs";
import { keys } from "@/lib/queryKeys";

function messageFromError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

async function fetchExportJobs() {
  const { data, error } = await supabase
    .from("export_jobs")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as ExportJob[];
}

const STATUS_BADGES: Record<ExportStatus, string> = {
  queued: "bg-muted text-muted-foreground",
  running: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  failed: "bg-destructive/10 text-destructive",
  expired: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  deleted: "bg-muted text-muted-foreground",
};

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function canDownload(job: ExportJob) {
  return job.status === "completed" && Boolean(job.r2_key) && (!job.expires_at || new Date(job.expires_at).getTime() > Date.now());
}

export default function ExportCenter() {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = role === "admin";

  const jobsQuery = useQuery({
    queryKey: keys.exportJobs(),
    queryFn: fetchExportJobs,
    refetchInterval: (query) => {
      const jobs = (query.state.data ?? []) as ExportJob[];
      return jobs.some((job) => job.status === "queued" || job.status === "running") ? 5000 : false;
    },
  });

  const downloadMutation = useMutation({
    mutationFn: getExportDownloadUrl,
    onError: (error) => toast.error(messageFromError(error, "Could not open export")),
    onSuccess: (url) => {
      window.open(url, "_blank", "noopener,noreferrer");
      queryClient.invalidateQueries({ queryKey: keys.exportJobs() });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteExportFile,
    onError: (error) => toast.error(messageFromError(error, "Could not delete export file")),
    onSuccess: () => {
      toast.success("Export file deleted");
      queryClient.invalidateQueries({ queryKey: keys.exportJobs() });
    },
  });

  const jobs = jobsQuery.data ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Export Center"
        description="Download governed exports and review recent export activity."
        actions={
          <Button variant="outline" onClick={() => jobsQuery.refetch()} disabled={jobsQuery.isFetching}>
            <RefreshCw className={jobsQuery.isFetching ? "animate-spin" : undefined} />
            Refresh
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Export</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Rows</TableHead>
                <TableHead>Filters</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Downloads</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobsQuery.isLoading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell colSpan={8}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : jobs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <FileDown className="size-8 text-muted-foreground/40" />
                      <span>No exports yet.</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>
                      <div className="font-medium">{exportTypeLabel(job.export_type)}</div>
                      <div className="max-w-64 truncate text-xs text-muted-foreground">{job.filename ?? job.id}</div>
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_BADGES[job.status]} variant="secondary">
                        {job.status}
                      </Badge>
                      {job.error_message && (
                        <div className="mt-1 max-w-52 truncate text-xs text-destructive">{job.error_message}</div>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums">{job.row_count.toLocaleString()}</TableCell>
                    <TableCell className="max-w-72 truncate text-sm text-muted-foreground">{job.filter_summary}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatDate(job.created_at)}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatDate(job.expires_at)}</TableCell>
                    <TableCell className="tabular-nums">{job.download_count}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!canDownload(job) || downloadMutation.isPending}
                          onClick={() => downloadMutation.mutate(job.id)}
                        >
                          <Download />
                          Download
                        </Button>
                        {isAdmin && job.status === "completed" && (
                          <ConfirmDialog
                            title="Delete export file?"
                            description="The workbook file will be deleted early, but export metadata and audit fields will remain visible."
                            confirmLabel="Delete file"
                            destructive
                            onConfirm={() => deleteMutation.mutate(job.id)}
                            trigger={
                              <Button variant="ghost" size="icon" className="size-8" disabled={deleteMutation.isPending}>
                                <Trash2 className="text-destructive" />
                              </Button>
                            }
                          />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
