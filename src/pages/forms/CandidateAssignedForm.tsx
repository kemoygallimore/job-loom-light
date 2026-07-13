import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { AlertTriangle, CheckCircle2, FileText, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PolicyConsentBlock } from "@/components/legal/PolicyConsentBlock";
import LeadFormRenderer from "@/components/forms/LeadFormRenderer";
import {
  DATA_PROTECTION_CONSENT_TEXT,
  buildConsentPayload,
  loadConsentPolicyContext,
  type ConsentPolicyContext,
} from "@/lib/consentPolicies";
import {
  LeadFormField,
  LeadFormSchema,
  LeadFormValue,
  normalizeSchema,
  validateLeadFormFieldValue,
} from "@/lib/leadForms";
import { uploadToStorage } from "@/lib/storage";

type FormState = "loading" | "ready" | "unavailable" | "submitted";

interface LoadedForm {
  title: string;
  description: string | null;
  schema: LeadFormSchema;
  company_id: string;
  candidate_id: string;
}

function buildAnswerValue(value: LeadFormValue) {
  if (value instanceof File) return null;
  return value ?? null;
}

function messageFromError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function CandidateAssignedForm() {
  const { token = "" } = useParams();
  const [state, setState] = useState<FormState>("loading");
  const [form, setForm] = useState<LoadedForm | null>(null);
  const [values, setValues] = useState<Record<string, LeadFormValue>>({});
  const [confirmationValues, setConfirmationValues] = useState<Record<string, LeadFormValue>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [consent, setConsent] = useState(false);
  const [policyContext, setPolicyContext] = useState<ConsentPolicyContext | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!token) {
        setState("unavailable");
        return;
      }

      const { data, error } = await supabase.functions.invoke("candidate-form-verification", {
        body: { action: "load", token },
      });

      if (error || data?.error) {
        setState("unavailable");
        return;
      }

      setForm({
        title: data.title ?? "Candidate form",
        description: data.description ?? null,
        schema: normalizeSchema(data.schema),
        company_id: data.company_id,
        candidate_id: data.candidate_id,
      });
      setPolicyContext(await loadConsentPolicyContext(data.company_id));
      setState("ready");
    };

    load();
  }, [token]);

  const updateValue = (field: LeadFormField, value: LeadFormValue) => {
    setValues((current) => ({ ...current, [field.id]: value }));
    setErrors((current) => {
      const { [field.id]: _discard, [`${field.id}__confirmation`]: _discardConfirmation, ...rest } = current;
      return rest;
    });
  };

  const updateConfirmationValue = (field: LeadFormField, value: LeadFormValue) => {
    setConfirmationValues((current) => ({ ...current, [field.id]: value }));
    setErrors((current) => {
      const { [`${field.id}__confirmation`]: _discard, ...rest } = current;
      return rest;
    });
  };

  const validate = () => {
    if (!form) return {};
    const nextErrors: Record<string, string> = {};

    form.schema.fields.forEach((field) => {
      if (field.type === "section") return;
      const fieldError = validateLeadFormFieldValue(field, values[field.id], confirmationValues[field.id]);
      if (fieldError) {
        const errorKey = fieldError === "Confirmation must match." ? `${field.id}__confirmation` : field.id;
        nextErrors[errorKey] = fieldError;
      }
    });

    return nextErrors;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form || submitting) return;

    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error("Please fix the highlighted fields");
      return;
    }
    if (!consent) {
      toast.error("Please agree to the data protection policies");
      return;
    }

    setSubmitting(true);
    const answers: Record<string, unknown> = {};
    const uploadRows: Record<string, unknown>[] = [];

    try {
      for (const field of form.schema.fields) {
        if (field.type === "section") continue;
        const value = values[field.id];
        if (field.type === "file" && value instanceof File) {
          const upload = await uploadToStorage({
            file: value,
            category: "document",
            companyId: form.company_id,
            candidateId: form.candidate_id,
            fieldId: field.id,
          });
          answers[field.id] = {
            fileName: upload.filename,
            fileType: upload.contentType,
            fileSize: upload.size,
            bucket: upload.bucket,
            objectKey: upload.key,
          };
          uploadRows.push({
            field_id: field.id,
            bucket: upload.bucket,
            object_key: upload.key,
            file_name: upload.filename,
            file_type: upload.contentType,
            file_size: upload.size,
          });
        } else {
          answers[field.id] = buildAnswerValue(value);
        }
      }

      const { data, error } = await supabase.functions.invoke("candidate-form-verification", {
        body: {
          action: "submit",
          token,
          answers,
          upload_rows: uploadRows,
          consents: buildConsentPayload("data_protection", consent, DATA_PROTECTION_CONSENT_TEXT),
        },
      });
      if (error || data?.error) throw new Error(error?.message ?? data?.error ?? "Unable to submit form");
      setState("submitted");
      toast.success("Form submitted");
    } catch (error) {
      toast.error(messageFromError(error, "Unable to submit form"));
    } finally {
      setSubmitting(false);
    }
  };

  if (state === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (state === "unavailable" || !form) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
          <AlertTriangle className="mx-auto size-10 text-destructive" />
          <h1 className="mt-4 text-lg font-semibold">Form unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This form link is invalid, expired, completed, revoked, or no longer accepting submissions.
          </p>
        </div>
      </div>
    );
  }

  if (state === "submitted") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
          <CheckCircle2 className="mx-auto size-12 text-primary" />
          <h1 className="mt-4 text-xl font-semibold">Form submitted</h1>
          <p className="mt-2 text-sm text-muted-foreground">Your response has been securely connected to your candidate profile.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <main className="mx-auto w-full max-w-2xl rounded-xl border bg-card shadow-sm">
        <div className="border-b px-6 py-5">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
            <FileText className="size-4" />
            RizonHire Form
          </div>
          <h1 className="text-2xl font-bold">{form.title}</h1>
          {form.description && <p className="mt-2 text-sm text-muted-foreground">{form.description}</p>}
        </div>

        <form onSubmit={submit} className="flex flex-col gap-6 p-6">
          <LeadFormRenderer
            schema={form.schema}
            values={values}
            confirmationValues={confirmationValues}
            errors={errors}
            disabled={submitting}
            onChange={updateValue}
            onConfirmationChange={updateConfirmationValue}
          />
          <PolicyConsentBlock
            id="candidate-form-consent"
            context={policyContext}
            checked={consent}
            consentText={DATA_PROTECTION_CONSENT_TEXT}
            disabled={submitting}
            onCheckedChange={setConsent}
          />
          <Button type="submit" disabled={submitting || !consent} className="w-full">
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {submitting ? "Submitting..." : "Submit"}
          </Button>
        </form>
      </main>
    </div>
  );
}
