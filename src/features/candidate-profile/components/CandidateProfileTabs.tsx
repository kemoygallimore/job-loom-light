import ActivityTimeline, { type TimelineEvent } from "@/components/candidate/ActivityTimeline";
import CandidateDocuments from "@/components/candidate/CandidateDocuments";
import CandidateForms from "@/components/candidate/CandidateForms";
import CandidateNotes, { type NoteWithAuthor } from "@/components/candidate/CandidateNotes";
import InterviewFeedback from "@/components/candidate/InterviewFeedback";
import ResumeHistory from "@/components/candidate/ResumeHistory";
import ScreeningReview from "@/components/candidate/ScreeningReview";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ApplicationWithJob, Candidate } from "../types";

type ProfileSummary = {
  user_id: string;
  name?: string | null;
};

type Props = {
  applications: ApplicationWithJob[];
  candidate: Candidate;
  latestApp: ApplicationWithJob | null;
  notes: NoteWithAuthor[];
  profile: ProfileSummary;
  timelineEvents: TimelineEvent[];
  onNotesChange: (nextNotes: NoteWithAuthor[]) => void;
};

export function CandidateProfileTabs({
  applications,
  candidate,
  latestApp,
  notes,
  profile,
  timelineEvents,
  onNotesChange,
}: Props) {
  return (
    <>
      <Tabs defaultValue="notes" className="w-full">
        <TabsList className="flex w-full h-auto overflow-x-auto justify-start sm:grid sm:grid-cols-6">
          <TabsTrigger value="notes" className="whitespace-nowrap flex-shrink-0 sm:flex-1">Notes</TabsTrigger>
          <TabsTrigger value="feedback" className="whitespace-nowrap flex-shrink-0 sm:flex-1">Interview Feedback</TabsTrigger>
          <TabsTrigger value="resumes" className="whitespace-nowrap flex-shrink-0 sm:flex-1">Resume History</TabsTrigger>
          <TabsTrigger value="documents" className="whitespace-nowrap flex-shrink-0 sm:flex-1">Documents</TabsTrigger>
          <TabsTrigger value="forms" className="whitespace-nowrap flex-shrink-0 sm:flex-1">Forms</TabsTrigger>
          <TabsTrigger value="screening" className="whitespace-nowrap flex-shrink-0 sm:flex-1">Screening</TabsTrigger>
        </TabsList>

        <TabsContent value="notes" className="mt-4">
          <CandidateNotes
            candidateId={candidate.id}
            companyId={candidate.company_id}
            userId={profile.user_id}
            notes={notes}
            onNotesChange={onNotesChange}
          />
        </TabsContent>

        <TabsContent value="feedback" className="mt-4">
          <InterviewFeedback
            candidateId={candidate.id}
            companyId={candidate.company_id}
            userId={profile.user_id}
            jobs={applications.map((a) => ({
              id: a.job_id,
              title: a.job_title,
              hiring_manager: a.hiring_manager,
            }))}
            defaultJobId={latestApp?.job_id}
            currentUserName={profile.name ?? undefined}
          />
        </TabsContent>

        <TabsContent value="resumes" className="mt-4">
          <div className="bg-card border rounded-xl p-6" style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.04)" }}>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
              Resume History
            </h2>
            <ResumeHistory candidateId={candidate.id} />
          </div>
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <div className="bg-card border rounded-xl p-6" style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.04)" }}>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
              Documents
            </h2>
            <CandidateDocuments candidateId={candidate.id} companyId={candidate.company_id} />
          </div>
        </TabsContent>
        <TabsContent value="forms" className="mt-4">
          <CandidateForms candidateId={candidate.id} companyId={candidate.company_id} userId={profile.user_id} candidateEmail={candidate.email} />
        </TabsContent>
        <TabsContent value="screening" className="mt-4">{latestApp && <ScreeningReview applicationId={latestApp.id} />}</TabsContent>
      </Tabs>

      <ActivityTimeline events={timelineEvents} />
    </>
  );
}
