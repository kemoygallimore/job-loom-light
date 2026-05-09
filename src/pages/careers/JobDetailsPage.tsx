import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Building2, AlertCircle } from "lucide-react";

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
  const navigate = useNavigate();
  const [job, setJob] = useState<Job | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!companySlug || !jobId) return;

    const fetchJob = async () => {
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

    fetchJob();
  }, [companySlug, jobId]);

  const applyPath = job ? `/apply/${job.id}` : "#";
  const careersPath = `/${companySlug}/careers`;

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h1 className="text-xl font-semibold">This job is no longer available</h1>
          <p className="text-muted-foreground text-sm mt-2 mb-6">
            The position may have been filled or the listing has been removed.
          </p>
          <Link to={careersPath}>
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
                to={careersPath}
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

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex-1 w-full">
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
                className="prose prose-sm sm:prose-base max-w-none prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-li:text-foreground prose-a:text-primary"
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
                onClick={() => navigate(applyPath)}
              >
                Apply Now
              </Button>
            </div>
          </div>
        )}
      </main>

      {!loading && job && (
        <div className="sm:hidden fixed bottom-0 inset-x-0 p-4 bg-background/80 backdrop-blur border-t">
          <Button
            className="w-full h-12 text-base active:scale-[0.97] transition-transform"
            onClick={() => navigate(applyPath)}
          >
            Apply Now
          </Button>
        </div>
      )}

      <footer className="border-t mt-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 text-center">
          <p className="text-xs text-muted-foreground/50">
            Powered by <span className="font-medium">RizonHire</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
