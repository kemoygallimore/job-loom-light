import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EMPLOYMENT_TYPE_OPTIONS, MAX_JOB_LOCATION_LENGTH } from "@/lib/jobMetadata";

interface JobMetadataFieldsProps {
  location: string;
  employmentType: string;
  locationError?: string;
  employmentTypeError?: string;
  onLocationChange: (value: string) => void;
  onEmploymentTypeChange: (value: string) => void;
  disabled?: boolean;
}

export default function JobMetadataFields({
  location,
  employmentType,
  locationError,
  employmentTypeError,
  onLocationChange,
  onEmploymentTypeChange,
  disabled = false,
}: JobMetadataFieldsProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="flex flex-col gap-2">
        <Label htmlFor="job-location">Location</Label>
        <Input
          id="job-location"
          value={location}
          onChange={(event) => onLocationChange(event.target.value)}
          placeholder="Kingston, Jamaica or Remote"
          maxLength={MAX_JOB_LOCATION_LENGTH}
          disabled={disabled}
          aria-invalid={Boolean(locationError)}
          aria-describedby={locationError ? "job-location-error" : undefined}
        />
        {locationError ? (
          <p id="job-location-error" className="text-sm text-destructive">
            {locationError}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="job-employment-type">Employment type</Label>
        <Select value={employmentType} onValueChange={onEmploymentTypeChange} disabled={disabled}>
          <SelectTrigger id="job-employment-type" aria-invalid={Boolean(employmentTypeError)}>
            <SelectValue placeholder="Select employment type" />
          </SelectTrigger>
          <SelectContent>
            {EMPLOYMENT_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {employmentTypeError ? <p className="text-sm text-destructive">{employmentTypeError}</p> : null}
      </div>
    </div>
  );
}
