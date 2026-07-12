import { Linkedin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { COUNTRIES, EDUCATION_LEVELS } from "../constants";
import type { FormErrors } from "../types";

interface PersonalFieldsProps {
  name: string;
  email: string;
  phone: string;
  linkedinUrl: string;
  country: string;
  streetAddress: string;
  parishState: string;
  educationLevel: string;
  parishOptions: string[];
  errors: FormErrors;
  setName: (value: string) => void;
  setEmail: (value: string) => void;
  setPhone: (value: string) => void;
  setLinkedinUrl: (value: string) => void;
  setCountry: (value: string) => void;
  setStreetAddress: (value: string) => void;
  setParishState: (value: string) => void;
  setEducationLevel: (value: string) => void;
  clearError: (field: string) => void;
}

export function PersonalFields({
  name,
  email,
  phone,
  linkedinUrl,
  country,
  streetAddress,
  parishState,
  educationLevel,
  parishOptions,
  errors,
  setName,
  setEmail,
  setPhone,
  setLinkedinUrl,
  setCountry,
  setStreetAddress,
  setParishState,
  setEducationLevel,
  clearError,
}: PersonalFieldsProps) {
  return (
    <>
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
            clearError("name");
          }}
          placeholder="Jane Cooper"
          className={errors.name ? "border-destructive" : ""}
        />
        {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
      </div>

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
            clearError("email");
          }}
          placeholder="jane@email.com"
          className={errors.email ? "border-destructive" : ""}
        />
        {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
      </div>

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
            clearError("phone");
          }}
          placeholder="+1 (555) 000-0000"
          className={errors.phone ? "border-destructive" : ""}
        />
        {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
      </div>

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
            clearError("linkedinUrl");
          }}
          placeholder="https://www.linkedin.com/in/your-name"
          className={errors.linkedinUrl ? "border-destructive" : ""}
        />
        {errors.linkedinUrl && <p className="text-xs text-destructive">{errors.linkedinUrl}</p>}
      </div>

      <div className="space-y-4 rounded-lg border p-4">
        <h3 className="text-sm font-medium">Address</h3>
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
              clearError("streetAddress");
            }}
            placeholder="123 Main Street"
            className={errors.streetAddress ? "border-destructive" : ""}
          />
          {errors.streetAddress && <p className="text-xs text-destructive">{errors.streetAddress}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-sm">
              Country <span className="text-destructive">*</span>
            </Label>
            <Select
              value={country}
              onValueChange={(v) => {
                setCountry(v);
                clearError("country");
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

          <div className="space-y-1.5">
            <Label className="text-sm">
              Parish / State <span className="text-destructive">*</span>
            </Label>
            {parishOptions.length > 0 ? (
              <Select
                value={parishState}
                onValueChange={(v) => {
                  setParishState(v);
                  clearError("parishState");
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
                  clearError("parishState");
                }}
                placeholder="Enter parish or state"
                className={errors.parishState ? "border-destructive" : ""}
              />
            )}
            {errors.parishState && <p className="text-xs text-destructive">{errors.parishState}</p>}
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm">
          Education Level <span className="text-destructive">*</span>
        </Label>
        <Select
          value={educationLevel}
          onValueChange={(v) => {
            setEducationLevel(v);
            clearError("educationLevel");
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
    </>
  );
}
