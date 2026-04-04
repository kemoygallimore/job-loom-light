import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { uploadToStorage, UploadCategory } from "@/lib/uploadToStorage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type CandidateFileUploadProps = {
  companyId: string;
  jobId: string;
  candidateId: string;
  category: UploadCategory;
  label?: string;
};

type UploadState = "idle" | "uploading" | "saving" | "success" | "error";

export default function CandidateFileUpload({
  companyId,
  jobId,
  candidateId,
  category,
  label,
}: CandidateFileUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const acceptedFileTypes =
    category === "resume"
      ? ".pdf,.doc,.docx"
      : "video/mp4,video/webm,video/quicktime";

  const buttonLabel =
    label || (category === "resume" ? "Upload Resume" : "Upload Video");

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage("");
    setSuccessMessage("");
    setUploadState("idle");
    const file = event.target.files?.[0] || null;
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setErrorMessage("Please choose a file first.");
      return;
    }

    try {
      setErrorMessage("");
      setSuccessMessage("");
      setUploadState("uploading");

      const result = await uploadToStorage({
        file: selectedFile,
        companyId,
        jobId,
        candidateId,
        category,
      });

      setUploadState("saving");

      const { error } = await supabase.from("candidate_files").insert({
        company_id: companyId,
        job_id: jobId,
        candidate_id: candidateId,
        category,
        bucket: result.bucket,
        file_key: result.path,
        file_name: result.fileName,
        file_type: result.fileType,
        file_size: result.fileSize,
      });

      if (error) throw new Error(error.message);

      setUploadState("success");
      setSuccessMessage(
        category === "resume"
          ? "Resume uploaded successfully."
          : "Video uploaded successfully."
      );
      setSelectedFile(null);
    } catch (error) {
      console.error(error);
      setUploadState("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Upload failed."
      );
    }
  };

  const getStatusText = () => {
    switch (uploadState) {
      case "uploading": return "Uploading file...";
      case "saving": return "Saving file record...";
      case "success": return "Upload complete.";
      case "error": return "Upload failed.";
      default: return "";
    }
  };

  const isUploading = uploadState === "uploading" || uploadState === "saving";

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-sm font-medium text-foreground">{buttonLabel}</h3>
        <p className="text-xs text-muted-foreground">
          {category === "resume"
            ? "Accepted formats: PDF, DOC, DOCX"
            : "Accepted formats: MP4, WEBM, MOV"}
        </p>
      </div>

      <Input
        type="file"
        accept={acceptedFileTypes}
        onChange={handleFileChange}
        disabled={isUploading}
      />

      {selectedFile && (
        <div className="rounded-md border border-border bg-muted/50 p-3 space-y-1">
          <p className="text-sm text-foreground">
            File: <span className="font-medium">{selectedFile.name}</span>
          </p>
          <p className="text-xs text-muted-foreground">Type: {selectedFile.type}</p>
          <p className="text-xs text-muted-foreground">
            Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
          </p>
        </div>
      )}

      <Button onClick={handleUpload} disabled={!selectedFile || isUploading} className="w-full">
        {isUploading ? "Please wait..." : buttonLabel}
      </Button>

      {getStatusText() && (
        <p className="text-sm text-muted-foreground">{getStatusText()}</p>
      )}
      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
      {successMessage && <p className="text-sm text-green-600">{successMessage}</p>}
    </div>
  );
}
