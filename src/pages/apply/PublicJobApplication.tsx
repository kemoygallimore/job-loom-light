import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { CheckCircle2, FileText, Loader2, AlertCircle, Upload, X, Building2, Linkedin } from "lucide-react";
import { uploadResumeToR2 } from "@/lib/uploadResumeToR2";
import { uploadToStorage } from "@/lib/uploadToStorage";
import { sanitizeRichHtml } from "@/lib/sanitizeHtml";
import { Textarea } from "@/components/ui/textarea";
import { calculateScreeningScore, objectiveCredit, type ScreeningQuestion } from "@/lib/jobScreening";
import type { Json } from "@/integrations/supabase/types";
const EDUCATION_LEVELS = [
  "Primary Level Education",
  "Trade Certificate",
  "High School Diploma",
  "O'levels/CXC/CSEC",
  "A'levels/CAPE",
  "Associate's Degree",
  "Bachelor's Degree",
  "Post Graduate Degree",
  "Master's Degree",
  "PhD",
];

const COUNTRIES = [
  "Jamaica",
  "Trinidad and Tobago",
  "Barbados",
  "Bahamas",
  "Guyana",
  "Belize",
  "Antigua and Barbuda",
  "Dominica",
  "Grenada",
  "Saint Kitts and Nevis",
  "Saint Lucia",
  "Saint Vincent and the Grenadines",
  "Suriname",
  "Haiti",
  "United States",
  "Canada",
  "United Kingdom",
  "Australia",
  "Nigeria",
  "Ghana",
  "India",
];

const PARISHES_BY_COUNTRY: Record<string, string[]> = {
  Jamaica: [
    "Kingston",
    "St. Andrew",
    "St. Thomas",
    "Portland",
    "St. Mary",
    "St. Ann",
    "Trelawny",
    "St. James",
    "Hanover",
    "Westmoreland",
    "St. Elizabeth",
    "Manchester",
    "Clarendon",
    "St. Catherine",
  ],
  "Trinidad and Tobago": [
    "Port of Spain",
    "San Fernando",
    "Chaguanas",
    "Arima",
    "Point Fortin",
    "Diego Martin",
    "Tunapuna/Piarco",
    "San Juan/Laventille",
    "Couva-Tabaquite-Talparo",
    "Sangre Grande",
    "Siparia",
    "Penal-Debe",
    "Princes Town",
    "Mayaro/Rio Claro",
    "Tobago",
  ],
  Barbados: [
    "Christ Church",
    "St. Andrew",
    "St. George",
    "St. James",
    "St. John",
    "St. Joseph",
    "St. Lucy",
    "St. Michael",
    "St. Peter",
    "St. Philip",
    "St. Thomas",
  ],
  Bahamas: ["New Providence", "Grand Bahama", "Abaco", "Andros", "Eleuthera", "Exuma", "Long Island"],
  Guyana: [
    "Barima-Waini",
    "Pomeroon-Supenaam",
    "Essequibo Islands-West Demerara",
    "Demerara-Mahaica",
    "Mahaica-Berbice",
    "East Berbice-Corentyne",
    "Cuyuni-Mazaruni",
    "Potaro-Siparuni",
    "Upper Takutu-Upper Essequibo",
    "Upper Demerara-Berbice",
  ],
  "United States": [
    "Alabama",
    "Alaska",
    "Arizona",
    "Arkansas",
    "California",
    "Colorado",
    "Connecticut",
    "Delaware",
    "Florida",
    "Georgia",
    "Hawaii",
    "Idaho",
    "Illinois",
    "Indiana",
    "Iowa",
    "Kansas",
    "Kentucky",
    "Louisiana",
    "Maine",
    "Maryland",
    "Massachusetts",
    "Michigan",
    "Minnesota",
    "Mississippi",
    "Missouri",
    "Montana",
    "Nebraska",
    "Nevada",
    "New Hampshire",
    "New Jersey",
    "New Mexico",
    "New York",
    "North Carolina",
    "North Dakota",
    "Ohio",
    "Oklahoma",
    "Oregon",
    "Pennsylvania",
    "Rhode Island",
    "South Carolina",
    "South Dakota",
    "Tennessee",
    "Texas",
    "Utah",
    "Vermont",
    "Virginia",
    "Washington",
    "West Virginia",
    "Wisconsin",
    "Wyoming",
  ],
  Canada: [
    "Alberta",
    "British Columbia",
    "Manitoba",
    "New Brunswick",
    "Newfoundland and Labrador",
    "Nova Scotia",
    "Ontario",
    "Prince Edward Island",
    "Quebec",
    "Saskatchewan",
    "Northwest Territories",
    "Nunavut",
    "Yukon",
  ],
  "United Kingdom": ["England", "Scotland", "Wales", "Northern Ireland"],
};

export default function PublicJobApplication() {
  const { jobId } = useParams<{ jobId: string }>();
  const [job, setJob] = useState<{ id: string; title: string; description: string | null; company_id: string } | null>(
    null,
  );
  const [company, setCompany] = useState<{ id: string; name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Form
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [country, setCountry] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [parishState, setParishState] = useState("");
  const [educationLevel, setEducationLevel] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [additionalFiles, setAdditionalFiles] = useState<File[]>([]);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [screeningVersionId, setScreeningVersionId] = useState<string | null>(null);
  const [screeningQuestions, setScreeningQuestions] = useState<ScreeningQuestion[]>([]);
  const [screeningAnswers, setScreeningAnswers] = useState<Record<string, Json>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const additionalFilesInputRef = useRef<HTMLInputElement>(null);

  const MAX_ADDITIONAL_FILES = 10;
  const MAX_ADDITIONAL_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
  const ADDITIONAL_ACCEPT = ".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt";

  const parishOptions = PARISHES_BY_COUNTRY[country] ?? [];

  useEffect(() => {
    if (!jobId) return;

    const load = async () => {
      const { data: jobData, error: jobError } = await supabase
        .from("jobs")
        .select("id, title, description, company_id")
        .eq("id", jobId)
        .eq("status", "open")
        .maybeSingle();

      if (!jobData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setJob(jobData);

      const { data: companyData } = await supabase
        .from("companies")
        .select("id, name")
        .eq("id", jobData.company_id)
        .maybeSingle();
      setCompany(companyData ?? null);
      const { data: screeningVersion } = await supabase.from("job_screening_versions").select("id").eq("job_id", jobData.id).eq("status", "published").order("version", { ascending: false }).limit(1).maybeSingle();
      if (screeningVersion) {
        const { data: questionRows } = await supabase.from("job_screening_questions").select("*").eq("version_id", screeningVersion.id).order("position");
        const questionIds = (questionRows ?? []).map((question) => question.id);
        const { data: choiceRows } = questionIds.length ? await supabase.from("job_screening_choices").select("*").in("question_id", questionIds).order("position") : { data: [] };
        setScreeningVersionId(screeningVersion.id);
        setScreeningQuestions((questionRows ?? []).map((question) => ({ ...question, rubric: question.rubric, settings: question.settings, choices: (choiceRows ?? []).filter((choice) => choice.question_id === question.id) })));
      }
      setLoading(false);
    };

    load();
  }, [jobId]);

  // Reset parish when country changes
  useEffect(() => {
    setParishState("");
  }, [country]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Full name is required";
    if (!email.trim()) e.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Enter a valid email";
    if (!phone.trim()) e.phone = "Phone number is required";
    if (linkedinUrl.trim() && !/^https?:\/\/(www\.)?linkedin\.com\/.+/i.test(linkedinUrl.trim())) {
      e.linkedinUrl = "Enter a valid LinkedIn URL (e.g. https://www.linkedin.com/in/your-name)";
    }
    if (!country) e.country = "Country is required";
    if (!streetAddress.trim()) e.streetAddress = "Street address is required";
    if (!parishState) e.parishState = "Parish/State is required";
    if (!educationLevel) e.educationLevel = "Education level is required";
    if (!resumeFile) e.resume = "Resume is required";
    if (additionalFiles.some((f) => f.size > MAX_ADDITIONAL_FILE_BYTES)) {
      e.additionalFiles = "Each additional document must be 10 MB or smaller";
    }
    if (additionalFiles.length > MAX_ADDITIONAL_FILES) {
      e.additionalFiles = `You can upload at most ${MAX_ADDITIONAL_FILES} additional documents`;
    }
    if (!agreedToTerms) e.terms = "You must agree to the Data Protection Agreement to continue";
    for (const question of screeningQuestions) {
      const value = screeningAnswers[question.id];
      if (question.required && (value == null || value === "" || (Array.isArray(value) && value.length === 0))) e[`screening-${question.id}`] = "This answer is required";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const isValid = validate();
    if (!isValid) {
      toast.error("Please complete all required fields.");
      return;
    }

    if (!job || !company) {
      toast.error("Job details are still loading. Please try again.");
      return;
    }

    setSubmitting(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();

      // 1. Check if candidate already exists for this company + email
      const { data: existingCandidate, error: lookupError } = await supabase
        .from("candidates")
        .select("id")
        .eq("company_id", company.id)
        .ilike("email", normalizedEmail)
        .maybeSingle();

      if (lookupError) throw lookupError;

      let candidateId: string;

      if (existingCandidate) {
        // 2a. Existing candidate — check for duplicate application BEFORE uploading
        candidateId = existingCandidate.id;

        const { data: existingApp, error: appLookupError } = await supabase
          .from("applications")
          .select("id")
          .eq("job_id", job.id)
          .eq("candidate_id", candidateId)
          .maybeSingle();

        if (appLookupError) throw appLookupError;

        if (existingApp) {
          toast.error("You've already submitted an application for this job.");
          setSubmitting(false);
          return;
        }

        // Upload new resume and update candidate
        const resumeResult = await uploadResumeToR2({
          file: resumeFile!,
          companyId: company.id,
          candidateId,
          jobId: job.id,
        });

        const { error: updateError } = await supabase
          .from("candidates")
          .update({
            name: name.trim(),
            phone: phone.trim(),
            linkedin_url: linkedinUrl.trim() || null,
            country,
            street_address: streetAddress.trim(),
            parish_state: parishState,
            education_level: educationLevel,
            resume_url: resumeResult.key,
            resume_bucket: resumeResult.bucket,
            resume_object_key: resumeResult.key,
            resume_filename: resumeResult.filename,
            resume_content_type: resumeResult.contentType,
            resume_size_bytes: resumeResult.size,
          })
          .eq("id", candidateId);

        if (updateError) throw updateError;

        // Archive resume version
        const { error: archiveError } = await supabase.rpc("archive_resume_version", {
          _candidate_id: candidateId,
          _company_id: company.id,
          _job_id: job.id,
          _bucket: resumeResult.bucket,
          _file_key: resumeResult.key,
          _file_name: resumeResult.filename,
          _file_type: resumeResult.contentType,
          _file_size: resumeResult.size,
        });
        if (archiveError) console.error("Resume archive failed:", archiveError);
      } else {
        // 2b. New candidate — insert first, then upload, then patch
        candidateId = crypto.randomUUID();

        const { error: candidateError } = await supabase.from("candidates").insert({
          id: candidateId,
          company_id: company.id,
          name: name.trim(),
          email: normalizedEmail,
          phone: phone.trim(),
          linkedin_url: linkedinUrl.trim() || null,
          country,
          street_address: streetAddress.trim(),
          parish_state: parishState,
          education_level: educationLevel,
        });

        if (candidateError) throw candidateError;

        const resumeResult = await uploadResumeToR2({
          file: resumeFile!,
          companyId: company.id,
          candidateId,
          jobId: job.id,
        });

        const { error: resumeUpdateError } = await supabase
          .from("candidates")
          .update({
            resume_url: resumeResult.key,
            resume_bucket: resumeResult.bucket,
            resume_object_key: resumeResult.key,
            resume_filename: resumeResult.filename,
            resume_content_type: resumeResult.contentType,
            resume_size_bytes: resumeResult.size,
          })
          .eq("id", candidateId);

        if (resumeUpdateError) throw resumeUpdateError;

        // Archive resume version
        const { error: archiveError } = await supabase.rpc("archive_resume_version", {
          _candidate_id: candidateId,
          _company_id: company.id,
          _job_id: job.id,
          _bucket: resumeResult.bucket,
          _file_key: resumeResult.key,
          _file_name: resumeResult.filename,
          _file_type: resumeResult.contentType,
          _file_size: resumeResult.size,
        });
        if (archiveError) console.error("Resume archive failed:", archiveError);
      }

      // 3. Create application
      const { data: application, error: appError } = await supabase
        .from("applications")
        .insert({
          company_id: company.id,
          job_id: job.id,
          candidate_id: candidateId,
          stage: "applied",
        }).select("id").single();

      if (appError) throw appError;

      if (screeningVersionId && screeningQuestions.length) {
        const calculated = calculateScreeningScore(screeningQuestions, screeningAnswers);
        const { data: response, error: responseError } = await supabase.from("job_screening_responses").insert({
          company_id: company.id, application_id: application.id, version_id: screeningVersionId,
          status: calculated.status, score: calculated.score, review_needed_count: calculated.reviewNeededCount,
          finalized_at: calculated.status === "final" ? new Date().toISOString() : null,
        }).select("id").single();
        if (responseError) throw responseError;
        const { error: answerError } = await supabase.from("job_screening_answers").insert(screeningQuestions.map((question) => ({
          response_id: response.id, question_id: question.id, answer: screeningAnswers[question.id] ?? null,
          earned_percent: objectiveCredit(question, screeningAnswers[question.id]),
        })));
        if (answerError) throw answerError;
      }

      // Upload additional documents (best-effort; failures logged but do not block submission)
      for (const file of additionalFiles) {
        try {
          const docResult = await uploadToStorage({
            file,
            companyId: company.id,
            jobId: job.id,
            candidateId,
            category: "document",
          });
          const { error: docInsertError } = await supabase.from("candidate_files").insert({
            company_id: company.id,
            candidate_id: candidateId,
            job_id: job.id,
            category: "document",
            bucket: docResult.bucket,
            file_key: docResult.key,
            file_name: docResult.fileName,
            file_type: docResult.fileType,
            file_size: docResult.fileSize,
          });
          if (docInsertError) console.error("Additional document insert failed:", docInsertError);
        } catch (docErr) {
          console.error("Additional document upload failed:", docErr);
        }
      }

      setSubmitted(true);
    } catch (err: unknown) {
      console.error("Submit error:", err);
      const msg = err instanceof Error ? err.message : "Something went wrong";
      if (/linkedin/i.test(msg)) {
        setErrors((p) => ({ ...p, linkedinUrl: msg }));
        toast.error(msg);
      } else {
        toast.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="relative h-10 w-10">
            <div className="absolute inset-0 rounded-full border-[3px] border-muted" />
            <div className="absolute inset-0 rounded-full border-[3px] border-t-primary animate-spin" />
          </div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h1 className="text-xl font-semibold">This job is no longer available</h1>
          <p className="text-muted-foreground text-sm mt-2">
            The position may have been filled or the listing has been removed.
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center animate-fade-in">
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold" data-testid="application-success-message">Application Submitted!</h1>
          <p className="text-muted-foreground text-sm mt-2 max-w-sm mx-auto">
            Thank you for applying to <span className="font-medium text-foreground">{job?.title}</span>. We'll review
            your application and get back to you soon.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
          <h1 className="text-2xl font-bold tracking-tight">{job?.title}</h1>
          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
            <Building2 className="w-4 h-4" />
            {company?.name}
          </div>
          {job?.description && (
            <div
              className="prose prose-sm max-w-none mt-3 prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-li:text-foreground prose-a:text-primary"
              dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(job.description) }}
            />
          )}
        </div>
      </header>

      {/* Form */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full">
        <h2 className="text-lg font-semibold mb-6">Apply for this position</h2>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-sm">
              Full Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              data-testid="applicant-full-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setErrors((p) => ({ ...p, name: "" }));
              }}
              placeholder="Jane Cooper"
              className={errors.name ? "border-destructive" : ""}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm">
              Email Address <span className="text-destructive">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              data-testid="applicant-email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setErrors((p) => ({ ...p, email: "" }));
              }}
              placeholder="jane@email.com"
              className={errors.email ? "border-destructive" : ""}
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <Label htmlFor="phone" className="text-sm">
              Phone Number <span className="text-destructive">*</span>
            </Label>
            <Input
              id="phone"
              type="tel"
              data-testid="applicant-phone"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setErrors((p) => ({ ...p, phone: "" }));
              }}
              placeholder="+1 (555) 000-0000"
              className={errors.phone ? "border-destructive" : ""}
            />
            {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
          </div>

          {/* LinkedIn (optional) */}
          <div className="space-y-1.5">
            <Label htmlFor="linkedin" className="text-sm flex items-center gap-1.5">
              <Linkedin className="w-3.5 h-3.5 text-muted-foreground" />
              LinkedIn Profile <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="linkedin"
              type="url"
              data-testid="applicant-linkedin"
              value={linkedinUrl}
              onChange={(e) => {
                setLinkedinUrl(e.target.value);
                setErrors((p) => ({ ...p, linkedinUrl: "" }));
              }}
              placeholder="https://www.linkedin.com/in/your-name"
              className={errors.linkedinUrl ? "border-destructive" : ""}
            />
            {errors.linkedinUrl && <p className="text-xs text-destructive">{errors.linkedinUrl}</p>}
          </div>

          {/* Address section */}
          <div className="space-y-4 rounded-lg border p-4">
            <h3 className="text-sm font-medium">Address</h3>

            {/* Street Address */}
            <div className="space-y-1.5">
              <Label className="text-sm">
                Street Address <span className="text-destructive">*</span>
              </Label>
              <Input
                id="streetAddress"
                data-testid="applicant-street-address"
                value={streetAddress}
                onChange={(e) => {
                  setStreetAddress(e.target.value);
                  setErrors((p) => ({ ...p, streetAddress: "" }));
                }}
                placeholder="123 Main Street"
                className={errors.streetAddress ? "border-destructive" : ""}
              />
              {errors.streetAddress && <p className="text-xs text-destructive">{errors.streetAddress}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Country */}
              <div className="space-y-1.5">
                <Label className="text-sm">
                  Country <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={country}
                  onValueChange={(v) => {
                    setCountry(v);
                    setErrors((p) => ({ ...p, country: "" }));
                  }}
                >
                  <SelectTrigger data-testid="applicant-country-trigger" className={errors.country ? "border-destructive" : ""}>
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.country && <p className="text-xs text-destructive">{errors.country}</p>}
              </div>

              {/* Parish/State */}
              <div className="space-y-1.5">
                <Label className="text-sm">
                  Parish / State <span className="text-destructive">*</span>
                </Label>
                {parishOptions.length > 0 ? (
                  <Select
                    value={parishState}
                    onValueChange={(v) => {
                      setParishState(v);
                      setErrors((p) => ({ ...p, parishState: "" }));
                    }}
                  >
                    <SelectTrigger id="parishState" data-testid="applicant-parish-state-trigger" className={errors.parishState ? "border-destructive" : ""}>
                      <SelectValue placeholder="Select parish/state" />
                    </SelectTrigger>
                    <SelectContent>
                      {parishOptions.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    data-testid="applicant-parish-state-trigger"
                    value={parishState}
                    onChange={(e) => {
                      setParishState(e.target.value);
                      setErrors((p) => ({ ...p, parishState: "" }));
                    }}
                    placeholder="Enter parish or state"
                    className={errors.parishState ? "border-destructive" : ""}
                  />
                )}
                {errors.parishState && <p className="text-xs text-destructive">{errors.parishState}</p>}
              </div>
            </div>
          </div>

          {/* Education Level */}
          <div className="space-y-1.5">
            <Label className="text-sm">
              Education Level <span className="text-destructive">*</span>
            </Label>
            <Select
              value={educationLevel}
              onValueChange={(v) => {
                setEducationLevel(v);
                setErrors((p) => ({ ...p, educationLevel: "" }));
              }}
            >
              <SelectTrigger data-testid="applicant-education-level-trigger" className={errors.educationLevel ? "border-destructive" : ""}>
                <SelectValue placeholder="Select education level" />
              </SelectTrigger>
              <SelectContent>
                {EDUCATION_LEVELS.map((level) => (
                  <SelectItem key={level} value={level}>
                    {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.educationLevel && <p className="text-xs text-destructive">{errors.educationLevel}</p>}
          </div>

          {/* Resume */}
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
                setErrors((p) => ({ ...p, resume: "" }));
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

          {/* Additional documents (optional) */}
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
                setErrors((p) => ({ ...p, additionalFiles: "" }));
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

          {/* Data protection consent */}
          {screeningQuestions.length > 0 && <section className="space-y-4 rounded-xl border p-4">
            <div><h2 className="font-semibold">Screening questions</h2><p className="text-xs text-muted-foreground">Your answers help the hiring team review this application.</p></div>
            {screeningQuestions.map((question, index) => <div key={question.id} className="space-y-2">
              <Label>{index + 1}. {question.prompt}{question.required ? " *" : ""}</Label>
              {(question.type === "short_text" || question.type === "long_text") && <Textarea rows={question.type === "long_text" ? 5 : 2} value={String(screeningAnswers[question.id] ?? "")} onChange={(event) => setScreeningAnswers((current) => ({ ...current, [question.id]: event.target.value }))} />}
              {question.type === "number" && <Input type="number" value={String(screeningAnswers[question.id] ?? "")} onChange={(event) => setScreeningAnswers((current) => ({ ...current, [question.id]: Number(event.target.value) }))} />}
              {(question.type === "yes_no" || question.type === "single_choice") && <Select value={String(screeningAnswers[question.id] ?? "")} onValueChange={(value) => setScreeningAnswers((current) => ({ ...current, [question.id]: value }))}><SelectTrigger><SelectValue placeholder="Select an answer" /></SelectTrigger><SelectContent>{question.choices.map((choice) => <SelectItem key={choice.id} value={choice.id}>{choice.label}</SelectItem>)}</SelectContent></Select>}
              {question.type === "multi_select" && <div className="space-y-2">{question.choices.map((choice) => { const selected = Array.isArray(screeningAnswers[question.id]) ? screeningAnswers[question.id] as Json[] : []; return <label key={choice.id} className="flex items-center gap-2 rounded-md border p-2 text-sm"><Checkbox checked={selected.includes(choice.id)} onCheckedChange={(checked) => setScreeningAnswers((current) => ({ ...current, [question.id]: checked ? [...selected, choice.id] : selected.filter((value) => value !== choice.id) }))} />{choice.label}</label>; })}</div>}
              {errors[`screening-${question.id}`] && <p className="text-xs text-destructive">{errors[`screening-${question.id}`]}</p>}
            </div>)}
          </section>}

          <div className="space-y-1.5 pt-2">
            <div className="flex items-start gap-2.5 rounded-lg border bg-muted/30 p-3">
              <Checkbox
                id="terms"
                data-testid="applicant-consent-checkbox"
                checked={agreedToTerms}
                onCheckedChange={(v) => {
                  setAgreedToTerms(v === true);
                  setErrors((p) => ({ ...p, terms: "" }));
                }}
                className="mt-0.5"
              />
              <Label htmlFor="terms" className="text-sm font-normal leading-relaxed cursor-pointer">
                I agree to the{" "}
                <a
                  href="/legal/data-protection"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2 hover:no-underline"
                >
                  Data Protection Agreement
                </a>{" "}
                and consent to my information being collected, stored, and processed as described.
              </Label>
            </div>
            {errors.terms && <p className="text-xs text-destructive">{errors.terms}</p>}
          </div>

          <Button
            type="submit"
            data-testid="applicant-submit-button"
            className="w-full h-11 active:scale-[0.97] transition-transform"
            disabled={submitting || !agreedToTerms}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" /> Submitting...
              </>
            ) : (
              "Submit Application"
            )}
          </Button>
        </form>
      </main>

      <footer className="border-t mt-auto">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 text-center">
          <p className="text-xs text-muted-foreground/50">
            Powered by <span className="font-medium">RizonHire</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
