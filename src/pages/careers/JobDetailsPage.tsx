import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  ArrowLeft, Building2, Upload, CheckCircle2, FileText,
  Loader2, AlertCircle, X,
} from "lucide-react";
import { uploadResumeToR2 } from "@/lib/uploadResumeToR2";

interface Job {
  id: string;
  title: string;
  description: string | null;
  company_id: string;
}

interface Company {
  id: string;
  name: string;
}

export default function JobDetailsPage() {
  const { companySlug, jobId } = useParams<{ companySlug: string; jobId: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Application form
  const [applyOpen, setApplyOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!companySlug || !jobId) return;

    const fetch = async () => {
      const { data: companyData } = await supabase
        .from("companies")
        .select("id, name")
        .eq("slug", companySlug)
        .maybeSingle();

      if (!companyData) { setNotFound(true); setLoading(false); return; }
      setCompany(companyData);

      const { data: jobData } = await supabase
        .from("jobs")
        .select("id, title, description, company_id")
        .eq("id", jobId)
        .eq("company_id", companyData.id)
        .eq("status", "open")
        .maybeSingle();

      if (!jobData) { setNotFound(true); setLoading(false); return; }
      setJob(jobData);
      setLoading(false);
    };

    fetch();
  }, [companySlug, jobId]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Full name is required";
    if (!email.trim()) e.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Enter a valid email";
    if (!phone.trim()) e.phone = "Phone number is required";
    if (!resumeFile) e.resume = "Resume is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !job || !company) return;
    setSubmitting(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();

      // 1. Look up existing candidate by company + email
      const { data: existingCandidate, error: lookupError } = await supabase
        .from("candidates")
        .select("id")
        .eq("company_id", company.id)
        .ilike("email", normalizedEmail)
        .maybeSingle();

      if (lookupError) throw new Error(lookupError.message);

      let candidateId: string;

      if (existingCandidate) {
        candidateId = existingCandidate.id;

        // Check duplicate application before doing any upload
        const { data: existingApp, error: appLookupError } = await supabase
          .from("applications")
          .select("id")
          .eq("job_id", job.id)
          .eq("candidate_id", candidateId)
          .maybeSingle();

        if (appLookupError) throw new Error(appLookupError.message);

        if (existingApp) {
          toast.error("You've already submitted an application for this job.");
          setSubmitting(false);
          return;
        }

        // Upload new resume and update candidate basics
        const resumeResult = await uploadResumeToR2({
          file: resumeFile!,
          companyId: company.id,
          candidateId,
        });

        const { error: updateError } = await supabase
          .from("candidates")
          .update({
            name: name.trim(),
            phone: phone.trim(),
            resume_bucket: resumeResult.bucket,
            resume_object_key: resumeResult.key,
            resume_filename: resumeResult.filename,
            resume_content_type: resumeResult.contentType,
            resume_size_bytes: resumeResult.size,
          })
          .eq("id", candidateId);

        if (updateError) throw new Error(updateError.message || "Failed to update candidate");

        // Archive this resume version in candidate_files for history
        const { error: fileHistoryError } = await supabase.from("candidate_files").insert({
          company_id: company.id,
          job_id: job.id,
          candidate_id: candidateId,
          category: "resume",
          bucket: resumeResult.bucket,
          file_key: resumeResult.key,
          file_name: resumeResult.filename,
          file_type: resumeResult.contentType,
          file_size: resumeResult.size,
        });
        if (fileHistoryError) console.warn("Failed to archive resume version:", fileHistoryError.message);
      } else {
        // New candidate
        candidateId = crypto.randomUUID();

        const { error: candidateError } = await supabase.from("candidates").insert({
          id: candidateId,
          company_id: company.id,
          name: name.trim(),
          email: normalizedEmail,
          phone: phone.trim(),
        });

        if (candidateError) throw new Error(candidateError.message || "Failed to create candidate");

        const resumeResult = await uploadResumeToR2({
          file: resumeFile!,
          companyId: company.id,
          candidateId,
        });

        const { error: resumeMetadataError } = await supabase
          .from("candidates")
          .update({
            resume_bucket: resumeResult.bucket,
            resume_object_key: resumeResult.key,
            resume_filename: resumeResult.filename,
            resume_content_type: resumeResult.contentType,
            resume_size_bytes: resumeResult.size,
          })
          .eq("id", candidateId);

        if (resumeMetadataError) {
          throw new Error(resumeMetadataError.message || "Failed to attach the resume to the candidate");
        }

        // Archive this resume version in candidate_files for history
        const { error: fileHistoryError } = await supabase.from("candidate_files").insert({
          company_id: company.id,
          job_id: job.id,
          candidate_id: candidateId,
          category: "resume",
          bucket: resumeResult.bucket,
          file_key: resumeResult.key,
          file_name: resumeResult.filename,
          file_type: resumeResult.contentType,
          file_size: resumeResult.size,
        });
        if (fileHistoryError) console.warn("Failed to archive resume version:", fileHistoryError.message);
      }

      // 2. Create application
      const { error: appError } = await supabase
        .from("applications")
        .insert({
          company_id: company.id,
          job_id: job.id,
          candidate_id: candidateId,
          stage: "applied",
        });

      if (appError) throw new Error("Failed to submit application");

      setSubmitted(true);
      setName("");
      setEmail("");
      setPhone("");
      setResumeFile(null);
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h1 className="text-xl font-semibold">This job is no longer available</h1>
          <p className="text-muted-foreground text-sm mt-2 mb-6">
            The position may have been filled or the listing has been removed.
          </p>
          <Link to={`/careers/${companySlug}`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to all jobs
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
          {loading ? (
            <>
              <Skeleton className="h-4 w-32 mb-4" />
              <Skeleton className="h-8 w-72 mb-2" />
              <Skeleton className="h-5 w-40" />
            </>
          ) : (
            <div className="animate-fade-in">
              <Link
                to={`/careers/${companySlug}`}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> All positions
              </Link>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ lineHeight: 1.1 }}>
                {job?.title}
              </h1>
              <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                <Building2 className="w-4 h-4" />
                {company?.name}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex-1">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
            <Skeleton className="h-4 w-full mt-4" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : (
          <div className="animate-fade-in">
            {job?.description && (
              <div
                className="prose prose-sm sm:prose-base max-w-none text-foreground leading-relaxed"
                dangerouslySetInnerHTML={{ __html: job.description }}
              />
            )}

            <div className="mt-10 pt-8 border-t">
              <h2 className="text-lg font-semibold mb-2">Interested in this role?</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Submit your application and we'll be in touch.
              </p>
              <Button
                size="lg"
                className="active:scale-[0.97] transition-transform"
                onClick={() => { setSubmitted(false); setApplyOpen(true); }}
              >
                Apply Now
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* Sticky mobile CTA */}
      {!loading && job && (
        <div className="sm:hidden fixed bottom-0 inset-x-0 p-4 bg-background/80 backdrop-blur border-t">
          <Button
            className="w-full h-12 text-base active:scale-[0.97] transition-transform"
            onClick={() => { setSubmitted(false); setApplyOpen(true); }}
          >
            Apply Now
          </Button>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t mt-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 text-center">
          <p className="text-xs text-muted-foreground/50">
            Powered by <span className="font-medium">HireFlow</span>
          </p>
        </div>
      </footer>

      {/* Application Dialog */}
      <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
        <DialogContent className="sm:max-w-md">
          {submitted ? (
            <div className="py-8 text-center animate-fade-in">
              <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold">Application submitted!</h3>
              <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
                Thank you for applying. We'll review your application and get back to you soon.
              </p>
              <Button variant="outline" className="mt-6" onClick={() => setApplyOpen(false)}>
                Close
              </Button>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Apply for {job?.title}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="apply-name" className="text-sm">Full Name</Label>
                  <Input
                    id="apply-name"
                    value={name}
                    onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: "" })); }}
                    placeholder="Jane Cooper"
                    className={errors.name ? "border-destructive" : ""}
                  />
                  {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="apply-email" className="text-sm">Email Address</Label>
                  <Input
                    id="apply-email"
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: "" })); }}
                    placeholder="jane@email.com"
                    className={errors.email ? "border-destructive" : ""}
                  />
                  {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="apply-phone" className="text-sm">Phone Number</Label>
                  <Input
                    id="apply-phone"
                    type="tel"
                    value={phone}
                    onChange={e => { setPhone(e.target.value); setErrors(p => ({ ...p, phone: "" })); }}
                    placeholder="+1 (555) 000-0000"
                    className={errors.phone ? "border-destructive" : ""}
                  />
                  {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Resume</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx"
                    className="hidden"
                    onChange={e => {
                      setResumeFile(e.target.files?.[0] ?? null);
                      setErrors(p => ({ ...p, resume: "" }));
                    }}
                  />
                  {resumeFile ? (
                    <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2.5">
                      <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                      <span className="text-sm truncate flex-1">{resumeFile.name}</span>
                      <button
                        type="button"
                        onClick={() => { setResumeFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className={`w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed py-6 text-sm text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors ${errors.resume ? "border-destructive" : ""}`}
                    >
                      <Upload className="w-4 h-4" />
                      Upload PDF or DOC
                    </button>
                  )}
                  {errors.resume && <p className="text-xs text-destructive">{errors.resume}</p>}
                </div>
                <Button
                  type="submit"
                  className="w-full h-11 active:scale-[0.97] transition-transform"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Submitting...
                    </>
                  ) : (
                    "Submit Application"
                  )}
                </Button>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
