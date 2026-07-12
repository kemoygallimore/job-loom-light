import {
  Calendar,
  FileText,
  GraduationCap,
  Linkedin,
  Mail,
  MapPin,
  Phone,
  RotateCcw,
  User,
} from "lucide-react";
import CandidateTagsBar from "@/components/candidate/CandidateTagsBar";
import StageBadge from "@/components/shared/StageBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ApplicationWithJob, Candidate } from "../types";

type Props = {
  candidate: Candidate;
  latestApp: ApplicationWithJob | null;
  isRepeatApplicant: boolean;
  onEmailCandidate: () => void;
  onViewResume: () => void;
};

export function CandidateProfileHeader({
  candidate,
  latestApp,
  isRepeatApplicant,
  onEmailCandidate,
  onViewResume,
}: Props) {
  return (
    <div className="bg-card border rounded-xl overflow-hidden" style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.04)" }}>
      <div className="p-6 space-y-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
              <User className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold leading-tight">{candidate.name}</h1>
                {isRepeatApplicant && (
                  <Badge
                    variant="outline"
                    className="gap-1 text-xs font-medium border-amber-300 text-amber-700 dark:border-amber-600 dark:text-amber-400"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Repeat Applicant
                  </Badge>
                )}
              </div>
              {latestApp && <p className="text-sm text-muted-foreground mt-0.5">{latestApp.job_title}</p>}
            </div>
          </div>
          {latestApp && <StageBadge stage={latestApp.stage} />}
        </div>

        <CandidateTagsBar candidateId={candidate.id} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {candidate.email && (
            <div className="flex items-center gap-2.5 text-sm">
              <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <a href={`mailto:${candidate.email}`} className="text-primary hover:underline truncate">
                {candidate.email}
              </a>
            </div>
          )}
          {candidate.phone && (
            <div className="flex items-center gap-2.5 text-sm">
              <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-foreground">{candidate.phone}</span>
            </div>
          )}
          {(candidate.street_address || candidate.parish_state || candidate.country) && (
            <div className="flex items-center gap-2.5 text-sm sm:col-span-2">
              <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-foreground">
                {[candidate.street_address, candidate.parish_state, candidate.country].filter(Boolean).join(", ")}
              </span>
            </div>
          )}
          {candidate.education_level && (
            <div className="flex items-center gap-2.5 text-sm">
              <GraduationCap className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-foreground">{candidate.education_level}</span>
            </div>
          )}
          {candidate.linkedin_url && (
            <div className="flex items-center gap-2.5 text-sm">
              <Linkedin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <a
                href={candidate.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline truncate"
              >
                LinkedIn Profile
              </a>
            </div>
          )}
          <div className="flex items-center gap-2.5 text-sm">
            <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="text-muted-foreground">Added {new Date(candidate.created_at).toLocaleDateString()}</span>
          </div>
          {!candidate.email && !candidate.phone && (
            <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <Mail className="w-4 h-4 flex-shrink-0" />
              <span>No contact info</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {candidate.email && (
            <Button variant="outline" size="sm" className="gap-2" onClick={onEmailCandidate}>
              <Mail className="w-4 h-4" />
              Email Candidate
            </Button>
          )}
          {candidate.resume_url && (
            <Button variant="outline" size="sm" className="gap-2" onClick={onViewResume}>
              <FileText className="w-4 h-4" />
              View Resume
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
