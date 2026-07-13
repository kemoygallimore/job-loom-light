import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import type { ScreeningQuestion } from "@/lib/jobScreening";
import {
  cleanupUploadedApplicationFiles,
  loadPublicApplicationContext,
  uploadAdditionalDocument,
  uploadResumeFile,
  submitPublicJobApplication,
} from "@/features/public-job-application/api";
import { MAX_ADDITIONAL_FILE_BYTES, MAX_ADDITIONAL_FILES, PARISHES_BY_COUNTRY } from "@/features/public-job-application/constants";
import { ApplicationFooter } from "@/features/public-job-application/components/ApplicationFooter";
import { ConsentSubmitSection } from "@/features/public-job-application/components/ConsentSubmitSection";
import { FileUploadFields } from "@/features/public-job-application/components/FileUploadFields";
import { JobHeader } from "@/features/public-job-application/components/JobHeader";
import { PersonalFields } from "@/features/public-job-application/components/PersonalFields";
import { ScreeningQuestionsSection } from "@/features/public-job-application/components/ScreeningQuestionsSection";
import { ApplicationLoadingScreen, ApplicationSuccessScreen, JobNotFoundScreen } from "@/features/public-job-application/components/StatusScreens";
import type { ApplicationFormState, CompanySummary, FormErrors, JobSummary } from "@/features/public-job-application/types";

const initialFormState: ApplicationFormState = {
  name: "",
  email: "",
  phone: "",
  linkedinUrl: "",
  country: "",
  streetAddress: "",
  parishState: "",
  educationLevel: "",
  resumeFile: null,
  additionalFiles: [],
  agreedToTerms: false,
  screeningAnswers: {},
};

const GENERIC_SUBMIT_ERROR = "We could not submit your application. Please try again.";

const technicalSubmitErrorPatterns = [
  /requires a WHERE clause/i,
  /pg_temp/i,
  /Failed to run sql query/i,
  /syntax error/i,
  /null value in column/i,
  /duplicate key value violates/i,
  /violates row-level security/i,
];

function submitErrorMessage(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error && typeof error.message === "string"
        ? error.message
        : "";

  if (!message || technicalSubmitErrorPatterns.some((pattern) => pattern.test(message))) {
    return GENERIC_SUBMIT_ERROR;
  }

  return message;
}

export default function PublicJobApplication() {
  const { jobId } = useParams<{ jobId: string }>();
  const [job, setJob] = useState<JobSummary | null>(null);
  const [company, setCompany] = useState<CompanySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState<ApplicationFormState>(initialFormState);
  const [errors, setErrors] = useState<FormErrors>({});
  const [screeningVersionId, setScreeningVersionId] = useState<string | null>(null);
  const [screeningQuestions, setScreeningQuestions] = useState<ScreeningQuestion[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const additionalFilesInputRef = useRef<HTMLInputElement>(null);

  const parishOptions = PARISHES_BY_COUNTRY[form.country] ?? [];

  useEffect(() => {
    if (!jobId) return;

    const load = async () => {
      try {
        const context = await loadPublicApplicationContext(jobId);

        if (!context) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        setJob(context.job);
        setCompany(context.company);
        setScreeningVersionId(context.screeningVersionId);
        setScreeningQuestions(context.screeningQuestions);
      } catch (error) {
        console.error("Public application load failed:", error);
        toast.error("Could not load this application. Please try again.");
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [jobId]);

  useEffect(() => {
    setForm((current) => ({ ...current, parishState: "" }));
  }, [form.country]);

  const updateForm = <Key extends keyof ApplicationFormState>(key: Key, value: ApplicationFormState[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const clearError = (field: string) => {
    setErrors((current) => ({ ...current, [field]: "" }));
  };

  const validate = () => {
    const nextErrors: FormErrors = {};
    if (!form.name.trim()) nextErrors.name = "Full name is required";
    if (!form.email.trim()) nextErrors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) nextErrors.email = "Enter a valid email";
    if (!form.phone.trim()) nextErrors.phone = "Phone number is required";
    if (form.linkedinUrl.trim() && !/^https?:\/\/(www\.)?linkedin\.com\/.+/i.test(form.linkedinUrl.trim())) {
      nextErrors.linkedinUrl = "Enter a valid LinkedIn URL (e.g. https://www.linkedin.com/in/your-name)";
    }
    if (!form.country) nextErrors.country = "Country is required";
    if (!form.streetAddress.trim()) nextErrors.streetAddress = "Street address is required";
    if (!form.parishState) nextErrors.parishState = "Parish/State is required";
    if (!form.educationLevel) nextErrors.educationLevel = "Education level is required";
    if (!form.resumeFile) nextErrors.resume = "Resume is required";
    if (form.additionalFiles.some((file) => file.size > MAX_ADDITIONAL_FILE_BYTES)) {
      nextErrors.additionalFiles = "Each additional document must be 10 MB or smaller";
    }
    if (form.additionalFiles.length > MAX_ADDITIONAL_FILES) {
      nextErrors.additionalFiles = `You can upload at most ${MAX_ADDITIONAL_FILES} additional documents`;
    }
    if (!form.agreedToTerms) nextErrors.terms = "You must agree to the Data Protection Agreement to continue";
    for (const question of screeningQuestions) {
      const value = form.screeningAnswers[question.id];
      if (question.required && (value == null || value === "" || (Array.isArray(value) && value.length === 0))) {
        nextErrors[`screening-${question.id}`] = "This answer is required";
      }
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const buildCandidateInput = (normalizedEmail: string) => ({
    name: form.name,
    email: normalizedEmail,
    phone: form.phone,
    linkedinUrl: form.linkedinUrl,
    country: form.country,
    streetAddress: form.streetAddress,
    parishState: form.parishState,
    educationLevel: form.educationLevel,
  });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!validate()) {
      toast.error("Please complete all required fields.");
      return;
    }

    if (!job || !company || !form.resumeFile) { toast.error("Job details are still loading. Please try again."); return; }

    setSubmitting(true);

    try {
      const normalizedEmail = form.email.trim().toLowerCase();
      const candidateInput = buildCandidateInput(normalizedEmail);
      const uploadCandidateId = crypto.randomUUID();
      const uploadedFiles = [];

      try {
        const resumeResult = await uploadResumeFile(form.resumeFile, company.id, uploadCandidateId, job.id);
        uploadedFiles.push(resumeResult);

        const additionalDocumentResults = [];
        for (const file of form.additionalFiles) {
          const documentResult = await uploadAdditionalDocument(file, company.id, job.id, uploadCandidateId);
          additionalDocumentResults.push(documentResult);
          uploadedFiles.push(documentResult);
        }

        await submitPublicJobApplication({
          jobId: job.id,
          candidateId: uploadCandidateId,
          candidate: candidateInput,
          resume: resumeResult,
          additionalDocuments: additionalDocumentResults,
          screeningVersionId,
          screeningAnswers: form.screeningAnswers,
        });
      } catch (error) {
        await cleanupUploadedApplicationFiles(uploadedFiles);
        throw error;
      }

      setSubmitted(true);
    } catch (err: unknown) {
      console.error("Submit error:", err);
      const msg = submitErrorMessage(err);
      if (/linkedin/i.test(msg)) {
        setErrors((current) => ({ ...current, linkedinUrl: msg }));
        toast.error(msg);
      } else {
        toast.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <ApplicationLoadingScreen />;
  if (notFound) return <JobNotFoundScreen />;
  if (submitted) return <ApplicationSuccessScreen job={job} />;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <JobHeader job={job} company={company} />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full">
        <h2 className="text-lg font-semibold mb-6">Apply for this position</h2>
        <form onSubmit={handleSubmit} className="space-y-5">
          <PersonalFields
            {...form}
            parishOptions={parishOptions}
            errors={errors}
            setName={(value) => updateForm("name", value)}
            setEmail={(value) => updateForm("email", value)}
            setPhone={(value) => updateForm("phone", value)}
            setLinkedinUrl={(value) => updateForm("linkedinUrl", value)}
            setCountry={(value) => updateForm("country", value)}
            setStreetAddress={(value) => updateForm("streetAddress", value)}
            setParishState={(value) => updateForm("parishState", value)}
            setEducationLevel={(value) => updateForm("educationLevel", value)}
            clearError={clearError}
          />
          <FileUploadFields
            resumeFile={form.resumeFile}
            additionalFiles={form.additionalFiles}
            fileInputRef={fileInputRef}
            additionalFilesInputRef={additionalFilesInputRef}
            errors={errors}
            setResumeFile={(file) => updateForm("resumeFile", file)}
            setAdditionalFiles={(updater) => setForm((current) => ({ ...current, additionalFiles: typeof updater === "function" ? updater(current.additionalFiles) : updater }))}
            clearError={clearError}
          />
          <ScreeningQuestionsSection
            questions={screeningQuestions}
            answers={form.screeningAnswers}
            errors={errors}
            setAnswers={(updater) => setForm((current) => ({ ...current, screeningAnswers: typeof updater === "function" ? updater(current.screeningAnswers) : updater }))}
          />
          <ConsentSubmitSection
            agreedToTerms={form.agreedToTerms}
            submitting={submitting}
            errors={errors}
            setAgreedToTerms={(value) => updateForm("agreedToTerms", value)}
            clearError={clearError}
          />
        </form>
      </main>
      <ApplicationFooter />
    </div>
  );
}
