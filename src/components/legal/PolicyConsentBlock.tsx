import { ExternalLink } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  companyPolicyUrl,
  formatPolicyDate,
  type ConsentPolicyContext,
} from "@/lib/consentPolicies";

interface PolicyConsentBlockProps {
  id: string;
  context: ConsentPolicyContext | null;
  checked: boolean;
  consentText: string;
  error?: string;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export function PolicyConsentBlock({
  id,
  context,
  checked,
  consentText,
  error,
  disabled,
  onCheckedChange,
}: PolicyConsentBlockProps) {
  const companyUrl = companyPolicyUrl(context);

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3">
      <div className="flex flex-col gap-2 text-sm">
        <p className="font-medium">Please review these policies before submitting.</p>
        <ul className="flex flex-col gap-2 text-muted-foreground">
          {companyUrl && (
            <li>
              <a
                href={companyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary underline underline-offset-2 hover:no-underline"
              >
                {context?.company_policy_title ?? `${context?.company_name ?? "Company"} Candidate Privacy Notice`}
                <ExternalLink className="size-3" />
              </a>
              <span className="block text-xs">
                Last updated: {formatPolicyDate(context?.company_policy_published_at)}
              </span>
            </li>
          )}
          <li>
            <a
              href="/legal/data-protection"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary underline underline-offset-2 hover:no-underline"
            >
              {context?.platform_policy_title ?? "RizonHire Data Protection Policy"}
              <ExternalLink className="size-3" />
            </a>
            <span className="block text-xs">
              Last updated: {formatPolicyDate(context?.platform_policy_updated_at)}
            </span>
          </li>
        </ul>
      </div>

      <div className="flex items-start gap-2.5">
        <Checkbox
          id={id}
          data-testid={id === "terms" ? "applicant-consent-checkbox" : undefined}
          checked={checked}
          disabled={disabled}
          onCheckedChange={(value) => onCheckedChange(value === true)}
          className="mt-0.5"
        />
        <Label htmlFor={id} className="cursor-pointer text-sm font-normal leading-relaxed">
          {consentText}
        </Label>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
