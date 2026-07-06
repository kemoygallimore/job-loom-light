import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FILE_ACCEPT, LeadFormField, LeadFormSchema } from "@/lib/leadForms";
import { cn } from "@/lib/utils";

type FormValue = string | boolean | string[] | File | null | undefined;

interface LeadFormRendererProps {
  schema: LeadFormSchema;
  values: Record<string, FormValue>;
  errors?: Record<string, string>;
  disabled?: boolean;
  onChange: (field: LeadFormField, value: FormValue) => void;
}

export default function LeadFormRenderer({
  schema,
  values,
  errors = {},
  disabled,
  onChange,
}: LeadFormRendererProps) {
  return (
    <div className="flex flex-col gap-5">
      {schema.fields.map((field) => {
        if (field.type === "section") {
          return (
            <div key={field.id} className="border-t pt-5 first:border-t-0 first:pt-0">
              <h2 className="text-base font-semibold">{field.label}</h2>
              {field.helpText && <p className="mt-1 text-sm text-muted-foreground">{field.helpText}</p>}
            </div>
          );
        }

        const error = errors[field.id];
        const value = values[field.id];

        return (
          <div key={field.id} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <Label htmlFor={field.id} className="text-sm font-medium">
                {field.label}
                {field.required && <span className="text-destructive"> *</span>}
              </Label>
              {field.type === "file" && <span className="text-xs text-muted-foreground">Max 10 MB</span>}
            </div>

            {field.type === "text" && (
              <Input
                id={field.id}
                value={typeof value === "string" ? value : ""}
                placeholder={field.placeholder}
                disabled={disabled}
                aria-invalid={Boolean(error)}
                onChange={(event) => onChange(field, event.target.value)}
              />
            )}

            {field.type === "email" && (
              <Input
                id={field.id}
                type="email"
                value={typeof value === "string" ? value : ""}
                placeholder={field.placeholder}
                disabled={disabled}
                aria-invalid={Boolean(error)}
                onChange={(event) => onChange(field, event.target.value)}
              />
            )}

            {field.type === "phone" && (
              <Input
                id={field.id}
                type="tel"
                value={typeof value === "string" ? value : ""}
                placeholder={field.placeholder}
                disabled={disabled}
                aria-invalid={Boolean(error)}
                onChange={(event) => onChange(field, event.target.value)}
              />
            )}

            {field.type === "date" && (
              <Input
                id={field.id}
                type="date"
                value={typeof value === "string" ? value : ""}
                disabled={disabled}
                aria-invalid={Boolean(error)}
                onChange={(event) => onChange(field, event.target.value)}
              />
            )}

            {field.type === "textarea" && (
              <Textarea
                id={field.id}
                value={typeof value === "string" ? value : ""}
                placeholder={field.placeholder}
                disabled={disabled}
                rows={4}
                aria-invalid={Boolean(error)}
                onChange={(event) => onChange(field, event.target.value)}
              />
            )}

            {field.type === "select" && (
              <Select
                disabled={disabled}
                value={typeof value === "string" ? value : ""}
                onValueChange={(nextValue) => onChange(field, nextValue)}
              >
                <SelectTrigger id={field.id} aria-invalid={Boolean(error)}>
                  <SelectValue placeholder={field.placeholder || "Select an option"} />
                </SelectTrigger>
                <SelectContent>
                  {(field.options ?? []).map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {field.type === "radio" && (
              <RadioGroup
                value={typeof value === "string" ? value : ""}
                disabled={disabled}
                onValueChange={(nextValue) => onChange(field, nextValue)}
                className="gap-2"
              >
                {(field.options ?? []).map((option) => (
                  <label key={option} className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm">
                    <RadioGroupItem value={option} id={`${field.id}-${option}`} />
                    {option}
                  </label>
                ))}
              </RadioGroup>
            )}

            {field.type === "checkbox" && (
              <label className="flex items-start gap-2 rounded-md border bg-background px-3 py-2 text-sm">
                <Checkbox
                  id={field.id}
                  checked={value === true}
                  disabled={disabled}
                  onCheckedChange={(checked) => onChange(field, checked === true)}
                />
                <span>{field.placeholder || "Yes"}</span>
              </label>
            )}

            {field.type === "multi_select" && (
              <div className="flex flex-col gap-2">
                {(field.options ?? []).map((option) => {
                  const selected = Array.isArray(value) ? value.includes(option) : false;
                  return (
                    <label key={option} className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm">
                      <Checkbox
                        checked={selected}
                        disabled={disabled}
                        onCheckedChange={(checked) => {
                          const current = Array.isArray(value) ? value : [];
                          onChange(
                            field,
                            checked === true ? [...current, option] : current.filter((item) => item !== option),
                          );
                        }}
                      />
                      {option}
                    </label>
                  );
                })}
              </div>
            )}

            {field.type === "file" && (
              <Input
                id={field.id}
                type="file"
                accept={FILE_ACCEPT}
                disabled={disabled}
                aria-invalid={Boolean(error)}
                onChange={(event) => onChange(field, event.target.files?.[0] ?? null)}
              />
            )}

            {(field.helpText || error) && (
              <p className={cn("text-xs", error ? "text-destructive" : "text-muted-foreground")}>
                {error || field.helpText}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
