import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Video, Building2, FileVideo, BarChart3 } from "lucide-react";

interface CompanyStat {
  company_id: string;
  company_name: string;
  total_jobs: number;
  total_submissions: number;
}

interface JobStat {
  job_id: string;
  job_title: string;
  company_name: string;
  submission_count: number;
}

export default function ScreeningAnalytics() {
  const [companyStats, setCompanyStats] = useState<CompanyStat[]>([]);
  const [jobStats, setJobStats] = useState<JobStat[]>([]);
  const [totals, setTotals] = useState({ jobs: 0, submissions: 0, companies: 0 });

  useEffect(() => {
    const load = async () => {
      // Get all screening jobs with company info
      const { data: jobs } = await supabase
        .from("screening_jobs")
        .select("id, title, company_id");

      const { data: companies } = await supabase
        .from("companies")
        .select("id, name");

      const { data: subs } = await supabase
        .from("screening_submissions")
        .select("screening_job_id, company_id");

      if (!jobs || !companies) return;

      const companyMap = Object.fromEntries(companies.map((c: any) => [c.id, c.name]));

      // Count subs per job
      const subsByJob: Record<string, number> = {};
      const subsByCompany: Record<string, number> = {};
      subs?.forEach((s: any) => {
        subsByJob[s.screening_job_id] = (subsByJob[s.screening_job_id] || 0) + 1;
        subsByCompany[s.company_id] = (subsByCompany[s.company_id] || 0) + 1;
      });

      // Company stats
      const jobsByCompany: Record<string, number> = {};
      jobs.forEach((j: any) => {
        jobsByCompany[j.company_id] = (jobsByCompany[j.company_id] || 0) + 1;
      });

      const cs: CompanyStat[] = Object.keys(jobsByCompany).map(cid => ({
        company_id: cid,
        company_name: companyMap[cid] || "Unknown",
        total_jobs: jobsByCompany[cid],
        total_submissions: subsByCompany[cid] || 0,
      }));

      // Job stats
      const js: JobStat[] = jobs.map((j: any) => ({
        job_id: j.id,
        job_title: j.title,
        company_name: companyMap[j.company_id] || "Unknown",
        submission_count: subsByJob[j.id] || 0,
      }));

      setCompanyStats(cs);
      setJobStats(js.sort((a, b) => b.submission_count - a.submission_count));
      setTotals({
        jobs: jobs.length,
        submissions: subs?.length || 0,
        companies: new Set(jobs.map((j: any) => j.company_id)).size,
      });
    };
    load();
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <Video className="w-5 h-5 text-primary" />
        Video Screening Analytics
      </h2>

      {/* Platform Totals */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Companies</p>
              <p className="text-2xl font-bold tabular-nums">{totals.companies}</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Jobs</p>
              <p className="text-2xl font-bold tabular-nums">{totals.jobs}</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileVideo className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Submissions</p>
              <p className="text-2xl font-bold tabular-nums">{totals.submissions}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Per Company */}
      <div className="bg-card rounded-xl border p-5" style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.04)" }}>
        <h3 className="font-semibold mb-3">Per Company</h3>
        <div className="space-y-2">
          {companyStats.map(cs => (
            <div key={cs.company_id} className="flex items-center justify-between py-2 border-b last:border-0">
              <span className="font-medium">{cs.company_name}</span>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>{cs.total_jobs} jobs</span>
                <span>{cs.total_submissions} submissions</span>
              </div>
            </div>
          ))}
          {companyStats.length === 0 && (
            <p className="text-muted-foreground text-sm py-4 text-center">No screening data yet</p>
          )}
        </div>
      </div>

      {/* Per Job */}
      <div className="bg-card rounded-xl border p-5" style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.04)" }}>
        <h3 className="font-semibold mb-3">Submissions per Job</h3>
        <div className="space-y-2">
          {jobStats.map(js => (
            <div key={js.job_id} className="flex items-center justify-between py-2 border-b last:border-0">
              <div>
                <span className="font-medium">{js.job_title}</span>
                <span className="text-xs text-muted-foreground ml-2">{js.company_name}</span>
              </div>
              <span className="font-semibold tabular-nums">{js.submission_count}</span>
            </div>
          ))}
          {jobStats.length === 0 && (
            <p className="text-muted-foreground text-sm py-4 text-center">No screening data yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
