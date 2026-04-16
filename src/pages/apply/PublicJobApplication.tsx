import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  CheckCircle2, FileText, Loader2, AlertCircle, Upload, X, Building2,
} from "lucide-react";

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
  "Jamaica", "Trinidad and Tobago", "Barbados", "Bahamas", "Guyana",
  "Belize", "Antigua and Barbuda", "Dominica", "Grenada", "Saint Kitts and Nevis",
  "Saint Lucia", "Saint Vincent and the Grenadines", "Suriname", "Haiti",
  "United States", "Canada", "United Kingdom", "Australia", "Nigeria", "Ghana", "India",
];

const PARISHES_BY_COUNTRY: Record<string, string[]> = {
  Jamaica: [
    "Kingston", "St. Andrew", "St. Thomas", "Portland", "St. Mary",
    "St. Ann", "Trelawny", "St. James", "Hanover", "Westmoreland",
    "St. Elizabeth", "Manchester", "Clarendon", "St. Catherine",
  ],
  "Trinidad and Tobago": [
    "Port of Spain", "San Fernando", "Chaguanas", "Arima", "Point Fortin",
    "Diego Martin", "Tunapuna/Piarco", "San Juan/Laventille", "Couva-Tabaquite-Talparo",
    "Sangre Grande", "Siparia", "Penal-Debe", "Princes Town", "Mayaro/Rio Claro", "Tobago",
  ],
  Barbados: [
    "Christ Church", "St. Andrew", "St. George", "St. James", "St. John",
    "St. Joseph", "St. Lucy", "St. Michael", "St. Peter", "St. Philip", "St. Thomas",
  ],
  Bahamas: ["New Providence", "Grand Bahama", "Abaco", "Andros", "Eleuthera", "Exuma", "Long Island"],
  Guyana: [
    "Barima-Waini", "Pomeroon-Supenaam", "Essequibo Islands-West Demerara",
    "Demerara-Mahaica", "Mahaica-Berbice", "East Berbice-Corentyne",
    "Cuyuni-Mazaruni", "Potaro-Siparuni", "Upper Takutu-Upper Essequibo", "Upper Demerara-Berbice",
  ],
  "United States": [
    "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut",
    "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa",
    "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan",
    "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire",
    "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio",
    "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
    "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia",
    "Wisconsin", "Wyoming",
  ],
  Canada: [
    "Alberta", "British Columbia", "Manitoba", "New Brunswick", "Newfoundland and Labrador",
    "Nova Scotia", "Ontario", "Prince Edward Island", "Quebec", "Saskatchewan",
    "Northwest Territories", "Nunavut", "Yukon",
  ],
  "United Kingdom": ["England", "Scotland", "Wales", "Northern Ireland"],
};

export default function PublicJobApplication() {
  const { jobId } = useParams<{ jobId: string }>();
  const [job, setJob] = useState<{ id: string; title: string; description: string | null; company_id: string } | null>(null);
  const [company, setCompany] = useState<{ id: string; name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Form
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [parishState, setParishState] = useState("");
  const [educationLevel, setEducationLevel] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parishOptions = PARISHES_BY_COUNTRY[country] ?? [];

  useEffect(() => {
    if (!jobId) return;
    const load = async () => {
      const { data: jobData } = await supabase
        .from("jobs")
        .select("id, title, description, company_id")
        .eq("id", jobId)
        .eq("status", "open")
        .maybeSingle();

      if (!jobData) { setNotFound(true); setLoading(false); return; }
      setJob(jobData);

      const { data: companyData } = await supabase
        .from("companies")
        .select("id, name")
        .eq("id", jobData.company_id)
        .maybeSingle();

      setCompany(companyData);
      setLoading(false);
    };
    load();
  }, [jobId]);

  // Reset parish when country changes
  useEffect(() => { setParishState(""); }, [country]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Full name is required";
    if (!email.trim()) e.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Enter a valid email";
    if (!phone.trim()) e.phone = "Phone number is required";
    if (!country) e.country = "Country is required";
    if (!streetAddress.trim()) e.streetAddress = "Street address is required";
    if (!parishState) e.parishState = "Parish/State is required";
    if (!educationLevel) e.educationLevel = "Education level is required";
    if (!resumeFile) e.resume = "Resume is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !job || !company) return;
    setSubmitting(true);

    try {
      // Upload resume
      const ext = resumeFile!.name.split(".").pop();
      const filePath = `${company.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("resumes")
        .upload(filePath, resumeFile!);

      if (uploadError) throw new Error("Failed to upload resume");

      // Create candidate
      const { data: candidate, error: candidateError } = await supabase
        .from("candidates")
        .insert({
          company_id: company.id,
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          resume_url: filePath,
          country,
          street_address: streetAddress.trim(),
          parish_state: parishState,
          education_level: educationLevel,
        } as any)
        .select()
        .single();

      if (candidateError || !candidate) throw new Error("Failed to create candidate");

      // Create application
      const { error: appError } = await supabase
        .from("applications")
        .insert({
          company_id: company.id,
          job_id: job.id,
          candidate_id: (candidate as any).id,
          stage: "applied",
        });

      if (appError) throw new Error("Failed to submit application");

      setSubmitted(true);
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
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
          <h1 className="text-2xl font-bold">Application Submitted!</h1>
          <p className="text-muted-foreground text-sm mt-2 max-w-sm mx-auto">
            Thank you for applying to <span className="font-medium text-foreground">{job?.title}</span>. We'll review your application and get back to you soon.
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
            <p className="text-sm text-muted-foreground mt-3 whitespace-pre-wrap leading-relaxed">{job.description}</p>
          )}
        </div>
      </header>

      {/* Form */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full">
        <h2 className="text-lg font-semibold mb-6">Apply for this position</h2>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-sm">Full Name <span className="text-destructive">*</span></Label>
            <Input
              id="name"
              value={name}
              onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: "" })); }}
              placeholder="Jane Cooper"
              className={errors.name ? "border-destructive" : ""}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm">Email Address <span className="text-destructive">*</span></Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: "" })); }}
              placeholder="jane@email.com"
              className={errors.email ? "border-destructive" : ""}
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <Label htmlFor="phone" className="text-sm">Phone Number <span className="text-destructive">*</span></Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={e => { setPhone(e.target.value); setErrors(p => ({ ...p, phone: "" })); }}
              placeholder="+1 (555) 000-0000"
              className={errors.phone ? "border-destructive" : ""}
            />
            {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
          </div>

          {/* Address section */}
          <div className="space-y-4 rounded-lg border p-4">
            <h3 className="text-sm font-medium">Address</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Country */}
              <div className="space-y-1.5">
                <Label className="text-sm">Country <span className="text-destructive">*</span></Label>
                <Select value={country} onValueChange={v => { setCountry(v); setErrors(p => ({ ...p, country: "" })); }}>
                  <SelectTrigger className={errors.country ? "border-destructive" : ""}>
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.country && <p className="text-xs text-destructive">{errors.country}</p>}
              </div>

              {/* Parish/State */}
              <div className="space-y-1.5">
                <Label className="text-sm">Parish / State <span className="text-destructive">*</span></Label>
                {parishOptions.length > 0 ? (
                  <Select value={parishState} onValueChange={v => { setParishState(v); setErrors(p => ({ ...p, parishState: "" })); }}>
                    <SelectTrigger className={errors.parishState ? "border-destructive" : ""}>
                      <SelectValue placeholder="Select parish/state" />
                    </SelectTrigger>
                    <SelectContent>
                      {parishOptions.map(p => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={parishState}
                    onChange={e => { setParishState(e.target.value); setErrors(p => ({ ...p, parishState: "" })); }}
                    placeholder="Enter parish or state"
                    className={errors.parishState ? "border-destructive" : ""}
                  />
                )}
                {errors.parishState && <p className="text-xs text-destructive">{errors.parishState}</p>}
              </div>
            </div>

            {/* Street Address */}
            <div className="space-y-1.5">
              <Label className="text-sm">Street Address <span className="text-destructive">*</span></Label>
              <Input
                value={streetAddress}
                onChange={e => { setStreetAddress(e.target.value); setErrors(p => ({ ...p, streetAddress: "" })); }}
                placeholder="123 Main Street"
                className={errors.streetAddress ? "border-destructive" : ""}
              />
              {errors.streetAddress && <p className="text-xs text-destructive">{errors.streetAddress}</p>}
            </div>
          </div>

          {/* Education Level */}
          <div className="space-y-1.5">
            <Label className="text-sm">Education Level <span className="text-destructive">*</span></Label>
            <Select value={educationLevel} onValueChange={v => { setEducationLevel(v); setErrors(p => ({ ...p, educationLevel: "" })); }}>
              <SelectTrigger className={errors.educationLevel ? "border-destructive" : ""}>
                <SelectValue placeholder="Select education level" />
              </SelectTrigger>
              <SelectContent>
                {EDUCATION_LEVELS.map(level => (
                  <SelectItem key={level} value={level}>{level}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.educationLevel && <p className="text-xs text-destructive">{errors.educationLevel}</p>}
          </div>

          {/* Resume */}
          <div className="space-y-1.5">
            <Label className="text-sm">Resume <span className="text-destructive">*</span></Label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx"
              className="hidden"
              onChange={e => {
                setResumeFile(e.target.files?.[0] ?? null);
                setErrors(p => ({ ...p, resume: "" }));
              }}
            />
            {resumeFile ? (
              <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2.5">
                <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="text-sm truncate flex-1">{resumeFile.name}</span>
                <button
                  type="button"
                  onClick={() => { setResumeFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
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

          <Button
            type="submit"
            className="w-full h-11 active:scale-[0.97] transition-transform"
            disabled={submitting}
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
