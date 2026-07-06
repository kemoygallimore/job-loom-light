import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  applyInputMask,
  CONFIRMATION_FIELD_TYPES,
  getFileAccept,
  LeadFormField,
  LeadFormSchema,
  LeadFormValue,
} from "@/lib/leadForms";
import { cn } from "@/lib/utils";

interface LeadFormRendererProps {
  schema: LeadFormSchema;
  values: Record<string, LeadFormValue>;
  confirmationValues?: Record<string, LeadFormValue>;
  errors?: Record<string, string>;
  disabled?: boolean;
  selectedFieldId?: string | null;
  onChange: (field: LeadFormField, value: LeadFormValue) => void;
  onConfirmationChange?: (field: LeadFormField, value: LeadFormValue) => void;
  onFieldSelect?: (field: LeadFormField) => void;
}

const fieldBackgroundClasses = {
  default: "bg-background",
  blue: "bg-sky-50/70",
  green: "bg-emerald-50/70",
  slate: "bg-slate-50",
  rose: "bg-rose-50/70",
  amber: "bg-amber-50/70",
};

const fieldAccentClasses = {
  default: "border-border",
  blue: "border-sky-200 focus-within:border-sky-400",
  green: "border-emerald-200 focus-within:border-emerald-400",
  slate: "border-slate-300 focus-within:border-slate-500",
  rose: "border-rose-200 focus-within:border-rose-400",
  amber: "border-amber-200 focus-within:border-amber-400",
};

const themeClasses = {
  blue: "border-sky-100",
  green: "border-emerald-100",
  slate: "border-slate-200",
  rose: "border-rose-100",
  amber: "border-amber-100",
};

function confirmationId(field: LeadFormField) {
  return `${field.id}__confirmation`;
}

export default function LeadFormRenderer({
  schema,
  values,
  confirmationValues = {},
  errors = {},
  disabled,
  selectedFieldId,
  onChange,
  onConfirmationChange,
  onFieldSelect,
}: LeadFormRendererProps) {
  return (
    <div className={cn("flex flex-col gap-5 rounded-lg border p-4", themeClasses[schema.theme ?? "blue"])}>
      {schema.fields.map((field) => {
        if (field.type === "section") {
          return (
            <button
              key={field.id}
              type="button"
              className={cn(
                "border-t pt-5 text-left first:border-t-0 first:pt-0",
                onFieldSelect && "rounded-md px-2 transition hover:bg-muted/40",
                selectedFieldId === field.id && "ring-2 ring-primary",
              )}
              onClick={() => onFieldSelect?.(field)}
            >
              <h2 className="text-base font-semibold">{field.label}</h2>
              {field.helpText && <p className="mt-1 text-sm text-muted-foreground">{field.helpText}</p>}
            </button>
          );
        }

        const error = errors[field.id];
        const confirmationError = errors[confirmationId(field)];
        const value = values[field.id];
        const fieldBackground = field.style?.background ?? "default";
        const fieldAccent = field.style?.accent ?? "default";
        const hasConfirmation = Boolean(field.validation?.requireConfirmation && CONFIRMATION_FIELD_TYPES.has(field.type));
        const commonInputProps = {
          disabled,
          "aria-invalid": Boolean(error),
          maxLength: field.validation?.maxLength,
        };

        return (
          <div
            key={field.id}
            className={cn(
              "flex flex-col gap-2 rounded-lg border p-3 transition",
              fieldBackgroundClasses[fieldBackground],
              fieldAccentClasses[fieldAccent],
              onFieldSelect && "cursor-pointer hover:shadow-sm",
              selectedFieldId === field.id && "ring-2 ring-primary",
            )}
            onClick={() => onFieldSelect?.(field)}
          >
            <div className="flex items-baseline justify-between gap-3">
              <Label htmlFor={field.id} className="text-sm font-medium">
                {field.label}
                {field.required && <span className="text-destructive"> *</span>}
              </Label>
              {field.type === "file" && (
                <span className="text-xs text-muted-foreground">Max {field.upload?.maxSizeMb ?? 10} MB</span>
              )}
            </div>

            {field.type === "text" && (
              <Input
                id={field.id}
                value={typeof value === "string" ? value : ""}
                placeholder={field.placeholder}
                {...commonInputProps}
                onChange={(event) => onChange(field, applyInputMask(field, event.target.value))}
              />
            )}

            {field.type === "email" && (
              <Input
                id={field.id}
                type="email"
                value={typeof value === "string" ? value : ""}
                placeholder={field.placeholder}
                {...commonInputProps}
                onChange={(event) => onChange(field, applyInputMask(field, event.target.value))}
              />
            )}

            {field.type === "phone" && (
              <Input
                id={field.id}
                type="tel"
                value={typeof value === "string" ? value : ""}
                placeholder={field.placeholder}
                {...commonInputProps}
                onChange={(event) => onChange(field, applyInputMask(field, event.target.value))}
              />
            )}

            {field.type === "url" && (
              <Input
                id={field.id}
                type="url"
                value={typeof value === "string" ? value : ""}
                placeholder={field.placeholder}
                {...commonInputProps}
                onChange={(event) => onChange(field, applyInputMask(field, event.target.value))}
              />
            )}

            {field.type === "number" && (
              <Input
                id={field.id}
                type="number"
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

            {(field.type === "textarea" || field.type === "address") && (
              <Textarea
                id={field.id}
                value={typeof value === "string" ? value : ""}
                placeholder={field.placeholder}
                disabled={disabled}
                rows={4}
                aria-invalid={Boolean(error)}
                maxLength={field.validation?.maxLength}
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

            {field.type === "rating" && (
              <RadioGroup
                value={typeof value === "string" ? value : ""}
                disabled={disabled}
                onValueChange={(nextValue) => onChange(field, nextValue)}
                className="flex flex-wrap gap-2"
              >
                {[1, 2, 3, 4, 5].map((rating) => (
                  <label key={rating} className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm">
                    <RadioGroupItem value={String(rating)} id={`${field.id}-${rating}`} />
                    {rating}
                  </label>
                ))}
              </RadioGroup>
            )}

            {field.type === "file" && (
              <Input
                id={field.id}
                type="file"
                accept={getFileAccept(field)}
                disabled={disabled}
                aria-invalid={Boolean(error)}
                onChange={(event) => onChange(field, event.target.files?.[0] ?? null)}
              />
            )}

            {hasConfirmation && (
              <div className="flex flex-col gap-2">
                <Label htmlFor={confirmationId(field)} className="text-sm font-medium">
                  Confirm {field.label.toLowerCase()}
                </Label>
                <Input
                  id={confirmationId(field)}
                  type={field.type === "email" ? "email" : field.type === "phone" ? "tel" : field.type === "url" ? "url" : "text"}
                  value={typeof confirmationValues[field.id] === "string" ? confirmationValues[field.id] : ""}
                  placeholder={`Re-enter ${field.label.toLowerCase()}`}
                  disabled={disabled}
                  aria-invalid={Boolean(confirmationError)}
                  onChange={(event) => onConfirmationChange?.(field, applyInputMask(field, event.target.value))}
                />
                {confirmationError && <p className="text-xs text-destructive">{confirmationError}</p>}
              </div>
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
