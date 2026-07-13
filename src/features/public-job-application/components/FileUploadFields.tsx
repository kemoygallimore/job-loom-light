import { FileText, Upload, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { ADDITIONAL_ACCEPT, MAX_ADDITIONAL_FILES } from "../constants";
import type { FormErrors } from "../types";

interface FileUploadFieldsProps {
  resumeFile: File | null;
  additionalFiles: File[];
  fileInputRef: React.RefObject<HTMLInputElement>;
  additionalFilesInputRef: React.RefObject<HTMLInputElement>;
  errors: FormErrors;
  setResumeFile: (file: File | null) => void;
  setAdditionalFiles: React.Dispatch<React.SetStateAction<File[]>>;
  clearError: (field: string) => void;
}

export function FileUploadFields({
  resumeFile,
  additionalFiles,
  fileInputRef,
  additionalFilesInputRef,
  errors,
  setResumeFile,
  setAdditionalFiles,
  clearError,
}: FileUploadFieldsProps) {
  return (
    <>
      <div className="space-y-1.5">
        <Label className="text-sm">
          Resume <span className="text-destructive">*</span>
        </Label>
        <input
          ref={fileInputRef}
          type="file"
          data-testid="applicant-resume-upload"
          accept=".pdf,.doc,.docx"
          className="hidden"
          onChange={(e) => {
            setResumeFile(e.target.files?.[0] ?? null);
            clearError("resume");
          }}
        />
        {resumeFile ? (
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2.5">
            <FileText className="w-4 h-4 text-primary flex-shrink-0" />
            <span className="text-sm truncate flex-1">{resumeFile.name}</span>
            <button
              type="button"
              onClick={() => {
                setResumeFile(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
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

      <div className="space-y-1.5">
        <Label className="text-sm flex items-center gap-1.5">
          Additional Documents <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <p className="text-xs text-muted-foreground">
          If the job description asks for any extra documents (cover letter, certificates, portfolio,
          references, etc.), upload them here. Up to {MAX_ADDITIONAL_FILES} files, 10&nbsp;MB each.
        </p>
        <input
          ref={additionalFilesInputRef}
          type="file"
          multiple
          data-testid="applicant-additional-docs-upload"
          accept={ADDITIONAL_ACCEPT}
          className="hidden"
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? []);
            setAdditionalFiles((prev) => {
              const combined = [...prev, ...picked].slice(0, MAX_ADDITIONAL_FILES);
              return combined;
            });
            clearError("additionalFiles");
            if (additionalFilesInputRef.current) additionalFilesInputRef.current.value = "";
          }}
        />
        {additionalFiles.length > 0 && (
          <div className="space-y-2">
            {additionalFiles.map((f, idx) => (
              <div
                key={`${f.name}-${idx}`}
                className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2.5"
              >
                <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="text-sm truncate flex-1">{f.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums flex-shrink-0">
                  {(f.size / 1024 / 1024).toFixed(2)} MB
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setAdditionalFiles((prev) => prev.filter((_, i) => i !== idx))
                  }
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={`Remove ${f.name}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        {additionalFiles.length < MAX_ADDITIONAL_FILES && (
          <button
            type="button"
            onClick={() => additionalFilesInputRef.current?.click()}
            className={`w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed py-5 text-sm text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors ${errors.additionalFiles ? "border-destructive" : ""}`}
          >
            <Upload className="w-4 h-4" />
            {additionalFiles.length === 0 ? "Upload additional documents" : "Add more documents"}
          </button>
        )}
        {errors.additionalFiles && (
          <p className="text-xs text-destructive">{errors.additionalFiles}</p>
        )}
      </div>
    </>
  );
}
