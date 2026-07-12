import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { calculateScreeningScore, objectiveCredit, type ScreeningQuestion } from "@/lib/jobScreening";
import {
  archiveResumeVersion,
  createApplication,
  createScreeningResponse,
  findCandidateByEmail,
  findExistingApplication,
  insertCandidate,
  insertCandidateFile,
  insertScreeningAnswers,
  loadPublicApplicationContext,
  updateCandidateResume,
  updateExistingCandidate,
  uploadAdditionalDocument,
  uploadResumeFile,
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
      setLoading(false);
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

  const saveScreeningResponse = async (applicationId: string) => {
    if (!screeningVersionId || !screeningQuestions.length || !company) return;

    const calculated = calculateScreeningScore(screeningQuestions, form.screeningAnswers);
    const response = await createScreeningResponse({
      companyId: company.id,
      applicationId,
      screeningVersionId,
      status: calculated.status,
      score: calculated.score,
      reviewNeededCount: calculated.reviewNeededCount,
    });

    await insertScreeningAnswers(
      response.id,
      screeningQuestions.map((question) => ({
        question_id: question.id,
        answer: form.screeningAnswers[question.id] ?? null,
        earned_percent: objectiveCredit(question, form.screeningAnswers[question.id]),
      })),
    );
  };

  const uploadDocuments = async (candidateId: string) => {
    if (!job || !company) return;

    for (const file of form.additionalFiles) {
      try {
        const docResult = await uploadAdditionalDocument(file, company.id, job.id, candidateId);
        const docInsertError = await insertCandidateFile({
          company_id: company.id,
          candidate_id: candidateId,
          job_id: job.id,
          category: "document",
          bucket: docResult.bucket,
          file_key: docResult.key,
          file_name: docResult.filename,
          file_type: docResult.contentType,
          file_size: docResult.size,
        });
        if (docInsertError) console.error("Additional document insert failed:", docInsertError);
      } catch (docErr) {
        console.error("Additional document upload failed:", docErr);
      }
    }
  };

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
      const existingCandidate = await findCandidateByEmail(company.id, normalizedEmail);
      let candidateId: string;

      if (existingCandidate) {
        candidateId = existingCandidate.id;
        const existingApp = await findExistingApplication(job.id, candidateId);

        if (existingApp) {
          toast.error("You've already submitted an application for this job.");
          setSubmitting(false);
          return;
        }

        const resumeResult = await uploadResumeFile(form.resumeFile, company.id, candidateId, job.id);
        await updateExistingCandidate(candidateId, candidateInput, resumeResult);
        const archiveError = await archiveResumeVersion(candidateId, company.id, job.id, resumeResult);
        if (archiveError) console.error("Resume archive failed:", archiveError);
      } else {
        candidateId = crypto.randomUUID();
        await insertCandidate(candidateId, company.id, candidateInput);

        const resumeResult = await uploadResumeFile(form.resumeFile, company.id, candidateId, job.id);
        await updateCandidateResume(candidateId, resumeResult);
        const archiveError = await archiveResumeVersion(candidateId, company.id, job.id, resumeResult);
        if (archiveError) console.error("Resume archive failed:", archiveError);
      }

      const application = await createApplication(company.id, job.id, candidateId);
      await saveScreeningResponse(application.id);
      await uploadDocuments(candidateId);
      setSubmitted(true);
    } catch (err: unknown) {
      console.error("Submit error:", err);
      const msg = err instanceof Error ? err.message : "Something went wrong";
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
