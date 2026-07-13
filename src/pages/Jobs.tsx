import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Check, Copy, Link2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import JobEditorDialog from "@/components/jobs/JobEditorDialog";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { htmlToPlainText } from "@/lib/htmlToPlainText";

type Job = Database["public"]["Tables"]["jobs"]["Row"];

export default function Jobs() {
  const { profile, role, user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [search, setSearch] = useState("");
  const [companySlug, setCompanySlug] = useState<string | null>(null);
  const [maxOpenJobs, setMaxOpenJobs] = useState(5);
  const [copiedCareersLink, setCopiedCareersLink] = useState(false);
  const [copiedJobId, setCopiedJobId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"open" | "closed">("open");
  const [limitDialogOpen, setLimitDialogOpen] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("jobs").select("*").order("created_at", { ascending: false });
    setJobs((data as Job[]) ?? []);
  };

  useEffect(() => {
    if (!profile) return;

    load();

    supabase
      .from("companies")
      .select("slug")
      .eq("id", profile.company_id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setCompanySlug((data as { slug: string }).slug);
      });

    supabase
      .rpc("get_company_job_limit" as never, { _company_id: profile.company_id } as never)
      .then(({ data }) => {
        if (typeof data === "number") setMaxOpenJobs(data);
      });
  }, [profile]);

  const careersUrl = companySlug ? `${window.location.origin}/${companySlug}/careers` : null;
  const openJobsCount = jobs.filter((job) => job.status === "open").length;
  const atLimit = openJobsCount >= maxOpenJobs;

  const handleCopyCareersLink = async () => {
    if (!careersUrl) return;
    await navigator.clipboard.writeText(careersUrl);
    setCopiedCareersLink(true);
    toast.success("Careers link copied to clipboard");
    setTimeout(() => setCopiedCareersLink(false), 2000);
  };

  const handleCopyApplyLink = async (jobId: string) => {
    const link = `${window.location.origin}/apply/${jobId}`;
    await navigator.clipboard.writeText(link);
    setCopiedJobId(jobId);
    toast.success("Application link copied");
    setTimeout(() => setCopiedJobId(null), 2000);
  };

  const handleDelete = async (jobId: string) => {
    const { error } = await supabase.from("jobs").delete().eq("id", jobId);
    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Job deleted");
    await load();
  };

  const filteredJobs = jobs
    .filter((job) => job.status === activeTab)
    .filter((job) => job.title.toLowerCase().includes(search.toLowerCase()));

  const openJobsList = jobs.filter((job) => job.status === "open");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jobs"
        description={
          <p className="tabular-nums">
            <span className={atLimit ? "font-medium text-destructive" : ""}>{openJobsCount}</span>
            {" / "}
            {maxOpenJobs} open jobs used
          </p>
        }
        actions={
          <>
            {careersUrl ? (
              <Button variant="outline" onClick={handleCopyCareersLink} className="gap-2">
                {copiedCareersLink ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
                {copiedCareersLink ? "Copied!" : "Copy Careers Link"}
              </Button>
            ) : null}
            <Button
              onClick={() => {
                setEditingJob(null);
                setEditorOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Job
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "open" | "closed")}>
          <TabsList>
            <TabsTrigger value="open">
              Active
              <span className="ml-2 text-xs tabular-nums opacity-70">
                {jobs.filter((job) => job.status === "open").length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="closed">
              Closed
              <span className="ml-2 text-xs tabular-nums opacity-70">
                {jobs.filter((job) => job.status === "closed").length}
              </span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative w-full max-w-xs sm:w-auto">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search jobs..."
            className="pl-9"
          />
        </div>
      </div>

      <div
        className="overflow-hidden rounded-xl border bg-card"
        style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.04)" }}
      >
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="font-semibold">Title</TableHead>
              <TableHead className="hidden font-semibold sm:table-cell">Description</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold">Expires</TableHead>
              <TableHead className="font-semibold">Created</TableHead>
              <TableHead className="w-24 font-semibold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredJobs.map((job) => {
              const isExpired = job.expires_at ? new Date(job.expires_at).getTime() <= Date.now() : false;

              return (
                <TableRow key={job.id} className="group">
                  <TableCell className="font-medium">{job.title}</TableCell>
                  <TableCell className="hidden max-w-xs truncate text-sm text-muted-foreground sm:table-cell">
                    {htmlToPlainText(job.description).slice(0, 80)}
                  </TableCell>
                  <TableCell>
                    <span className={`badge-stage ${job.status === "open" ? "badge-hired" : "badge-rejected"}`}>
                      {job.status}
                    </span>
                    {isExpired && job.status === "open" ? (
                      <span className="ml-2 text-xs font-medium text-amber-700">Expired</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground tabular-nums">
                    {job.expires_at ? format(new Date(job.expires_at), "MMM d, yyyy") : "Not set"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground tabular-nums">
                    {format(new Date(job.created_at), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Copy apply link"
                        onClick={() => handleCopyApplyLink(job.id)}
                      >
                        {copiedJobId === job.id ? (
                          <Check className="h-3.5 w-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setEditingJob(job);
                          setEditorOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {role === "admin" ? (
                        <ConfirmDialog
                          title="Delete this job?"
                          description="This will permanently delete the job. This action cannot be undone."
                          confirmLabel="Delete job"
                          destructive
                          onConfirm={() => handleDelete(job.id)}
                          trigger={
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          }
                        />
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}

            {filteredJobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                  {search
                    ? "No jobs match your search"
                    : activeTab === "open"
                      ? "No active jobs. Create your first job posting."
                      : "No closed jobs yet."}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      {profile && user ? (
        <JobEditorDialog
          companyId={profile.company_id}
          maxOpenJobs={maxOpenJobs}
          onOpenChange={setEditorOpen}
          onOpenLimitDialog={() => setLimitDialogOpen(true)}
          onSaved={load}
          open={editorOpen}
          openJobsCount={openJobsCount}
          job={editingJob}
          userId={user.id}
        />
      ) : null}

      <Dialog open={limitDialogOpen} onOpenChange={setLimitDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Open job limit reached</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Your company has reached its limit of{" "}
              <span className="font-semibold text-foreground tabular-nums">{maxOpenJobs}</span> open jobs. Close one
              of the jobs below before posting a new one, or contact your platform administrator to increase the limit.
            </p>
            <div className="max-h-64 divide-y overflow-y-auto rounded-lg border">
              {openJobsList.map((job) => (
                <div key={job.id} className="flex items-center justify-between gap-3 p-3">
                  <span className="truncate text-sm font-medium">{job.title}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      const { error } = await supabase
                        .from("jobs")
                        .update({ status: "closed" })
                        .eq("id", job.id);

                      if (error) {
                        toast.error(error.message);
                        return;
                      }

                      toast.success("Job closed");
                      setLimitDialogOpen(false);
                      await load();
                    }}
                  >
                    Close
                  </Button>
                </div>
              ))}
            </div>
            <Button className="w-full" variant="secondary" onClick={() => setLimitDialogOpen(false)}>
              Got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
