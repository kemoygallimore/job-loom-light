import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { AlertTriangle, CheckCircle2, FileText, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import LeadFormRenderer from "@/components/forms/LeadFormRenderer";
import {
  LeadFormField,
  LeadFormSchema,
  validateUploadFile,
  normalizeSchema,
} from "@/lib/leadForms";
import { uploadLeadFormFileToR2 } from "@/lib/uploadLeadFormFileToR2";

type PublicFormState = "loading" | "ready" | "unavailable" | "submitted";
type FormValue = string | boolean | string[] | File | null | undefined;

type QueryResult = { data: unknown; error: { message: string } | null };
type LeadFormsQuery = PromiseLike<QueryResult> & {
  insert: (payload: unknown) => LeadFormsQuery;
};
type LeadFormsDb = {
  from: (table: string) => LeadFormsQuery;
  rpc: (fn: string, args: Record<string, unknown>) => Promise<QueryResult>;
};

const leadFormsDb = supabase as unknown as LeadFormsDb;

interface PublicLeadFormRecord {
  id: string;
  company_id: string;
  title: string;
  description: string | null;
  schema: LeadFormSchema;
}

function isEmptyValue(value: FormValue) {
  if (value instanceof File) return false;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "boolean") return value === false;
  return value === null || value === undefined || String(value).trim() === "";
}

function buildAnswerValue(value: FormValue) {
  if (value instanceof File) return null;
  return value ?? null;
}

function messageFromError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function PublicLeadForm() {
  const { publicId } = useParams<{ publicId: string }>();
  const [state, setState] = useState<PublicFormState>("loading");
  const [form, setForm] = useState<PublicLeadFormRecord | null>(null);
  const [values, setValues] = useState<Record<string, FormValue>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [honeypot, setHoneypot] = useState("");

  useEffect(() => {
    const load = async () => {
      if (!publicId) {
        setState("unavailable");
        return;
      }

      const { data, error } = await leadFormsDb.rpc("get_public_lead_form", {
        _public_id: publicId,
      });

      const row = Array.isArray(data) ? data[0] : data;
      if (error || !row) {
        setState("unavailable");
        return;
      }

      setForm({ ...row, schema: normalizeSchema(row.schema) });
      setState("ready");
    };

    load();
  }, [publicId]);

  const updateValue = (field: LeadFormField, value: FormValue) => {
    setValues((current) => ({ ...current, [field.id]: value }));
    setErrors((current) => {
      const { [field.id]: _discard, ...rest } = current;
      return rest;
    });
  };

  const validate = () => {
    if (!form) return {};
    const nextErrors: Record<string, string> = {};

    form.schema.fields.forEach((field) => {
      if (field.type === "section") return;
      const value = values[field.id];
      if (field.required && isEmptyValue(value)) {
        nextErrors[field.id] = "This field is required.";
        return;
      }
      if (field.type === "email" && typeof value === "string" && value.trim() && !/^\S+@\S+\.\S+$/.test(value)) {
        nextErrors[field.id] = "Enter a valid email address.";
      }
      if (field.type === "file" && value instanceof File) {
        const fileError = validateUploadFile(value);
        if (fileError) nextErrors[field.id] = fileError;
      }
    });

    return nextErrors;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form) return;
    if (honeypot.trim()) {
      setState("submitted");
      return;
    }

    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error("Please fix the highlighted fields");
      return;
    }

    setSubmitting(true);
    const submissionId = crypto.randomUUID();
    const answers: Record<string, unknown> = {};
    const uploadRows: Record<string, unknown>[] = [];

    try {
      for (const field of form.schema.fields) {
        if (field.type === "section") continue;
        const value = values[field.id];

        if (field.type === "file" && value instanceof File) {
          const upload = await uploadLeadFormFileToR2({
            file: value,
            companyId: form.company_id,
            formId: form.id,
            submissionId,
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
            submission_id: submissionId,
            form_id: form.id,
            company_id: form.company_id,
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

      const { error: submissionError } = await leadFormsDb.from("lead_form_submissions").insert({
        id: submissionId,
        form_id: form.id,
        company_id: form.company_id,
        answers,
        schema_snapshot: form.schema,
        status: "new",
      });

      if (submissionError) throw new Error(submissionError.message);

      if (uploadRows.length > 0) {
        const { error: uploadError } = await leadFormsDb.from("lead_form_uploads").insert(uploadRows);
        if (uploadError) throw new Error(uploadError.message);
      }

      setState("submitted");
      toast.success("Form submitted");
    } catch (error: unknown) {
      toast.error(messageFromError(error, "Failed to submit form"));
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
            This form link is invalid, disabled, or no longer accepting submissions.
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
          <h1 className="mt-4 text-xl font-semibold">Thank you</h1>
          <p className="mt-2 text-sm text-muted-foreground">Your submission has been received.</p>
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
          <input
            className="hidden"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(event) => setHoneypot(event.target.value)}
            aria-hidden="true"
          />
          <LeadFormRenderer schema={form.schema} values={values} errors={errors} disabled={submitting} onChange={updateValue} />
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {submitting ? "Submitting..." : "Submit"}
          </Button>
        </form>
      </main>
    </div>
  );
}
