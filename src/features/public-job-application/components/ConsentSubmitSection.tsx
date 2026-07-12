import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { FormErrors } from "../types";

interface ConsentSubmitSectionProps {
  agreedToTerms: boolean;
  submitting: boolean;
  errors: FormErrors;
  setAgreedToTerms: (value: boolean) => void;
  clearError: (field: string) => void;
}

export function ConsentSubmitSection({
  agreedToTerms,
  submitting,
  errors,
  setAgreedToTerms,
  clearError,
}: ConsentSubmitSectionProps) {
  return (
    <>
      <div className="space-y-1.5 pt-2">
        <div className="flex items-start gap-2.5 rounded-lg border bg-muted/30 p-3">
          <Checkbox
            id="terms"
            data-testid="applicant-consent-checkbox"
            checked={agreedToTerms}
            onCheckedChange={(v) => {
              setAgreedToTerms(v === true);
              clearError("terms");
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
    </>
  );
}
