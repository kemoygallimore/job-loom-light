import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PolicyConsentBlock } from "@/components/legal/PolicyConsentBlock";
import { DATA_PROTECTION_CONSENT_TEXT, type ConsentPolicyContext } from "@/lib/consentPolicies";
import type { FormErrors } from "../types";

interface ConsentSubmitSectionProps {
  agreedToTerms: boolean;
  submitting: boolean;
  errors: FormErrors;
  policyContext: ConsentPolicyContext | null;
  setAgreedToTerms: (value: boolean) => void;
  clearError: (field: string) => void;
}

export function ConsentSubmitSection({
  agreedToTerms,
  submitting,
  errors,
  policyContext,
  setAgreedToTerms,
  clearError,
}: ConsentSubmitSectionProps) {
  return (
    <>
      <PolicyConsentBlock
        id="terms"
        context={policyContext}
        checked={agreedToTerms}
        consentText={DATA_PROTECTION_CONSENT_TEXT}
        error={errors.terms}
        onCheckedChange={(checked) => {
          setAgreedToTerms(checked);
          clearError("terms");
        }}
      />

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
