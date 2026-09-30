import { BriefcaseBusiness, MapPin } from "lucide-react";

import { getEmploymentTypeLabel, getJobMetadataDisplayValue } from "@/lib/jobMetadata";

interface PublicJobMetadataProps {
  location: string | null | undefined;
  employmentType: string | null | undefined;
  className?: string;
}

export default function PublicJobMetadata({ location, employmentType, className }: PublicJobMetadataProps) {
  return (
    <div className={`flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground ${className ?? ""}`}>
      <span className="inline-flex items-center gap-1.5">
        <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
        <span>
          <span className="font-medium text-foreground/75">Location:</span> {getJobMetadataDisplayValue(location)}
        </span>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <BriefcaseBusiness className="h-3.5 w-3.5" aria-hidden="true" />
        <span>
          <span className="font-medium text-foreground/75">Employment type:</span> {getEmploymentTypeLabel(employmentType)}
        </span>
      </span>
    </div>
  );
}
