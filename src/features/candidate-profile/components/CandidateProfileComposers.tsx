import { CandidateEmailComposer } from "@/components/email/CandidateEmailComposer";
import type { ApplicationWithJob, Candidate } from "../types";

type Props = {
  candidate: Candidate;
  emailComposerOpen: boolean;
  latestApp: ApplicationWithJob | null;
  rejectionApplication: ApplicationWithJob | null;
  onEmailComposerOpenChange: (open: boolean) => void;
  onRejectionComposerOpenChange: (open: boolean) => void;
  onRejectionSent: (applicationIds: string[]) => void;
};

export function CandidateProfileComposers({
  candidate,
  emailComposerOpen,
  latestApp,
  rejectionApplication,
  onEmailComposerOpenChange,
  onRejectionComposerOpenChange,
  onRejectionSent,
}: Props) {
  return (
    <>
      <CandidateEmailComposer
        open={emailComposerOpen}
        onOpenChange={onEmailComposerOpenChange}
        recipients={[
          {
            candidateId: candidate.id,
            applicationId: latestApp?.id ?? null,
            candidateName: candidate.name,
            candidateEmail: candidate.email,
            jobId: latestApp?.job_id ?? null,
            jobTitle: latestApp?.job_title ?? null,
          },
        ]}
      />

      <CandidateEmailComposer
        open={Boolean(rejectionApplication)}
        mode="rejection"
        onOpenChange={onRejectionComposerOpenChange}
        onSent={onRejectionSent}
        recipients={
          rejectionApplication
            ? [
                {
                  candidateId: candidate.id,
                  applicationId: rejectionApplication.id,
                  candidateName: candidate.name,
                  candidateEmail: candidate.email,
                  jobId: rejectionApplication.job_id,
                  jobTitle: rejectionApplication.job_title,
                },
              ]
            : []
        }
      />
    </>
  );
}
