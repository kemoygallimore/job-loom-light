import { useEffect, useMemo, useState } from "react";
import { FileText, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { inviteResultDescription, sendCandidateFormInvites } from "@/lib/candidateFormInvitations";

export interface CandidateFormRecipient {
  candidateId: string;
  candidateName: string;
  candidateEmail: string | null;
}

interface LeadFormOption {
  id: string;
  title: string;
}

type Props = {
  open: boolean;
  recipients: CandidateFormRecipient[];
  onOpenChange: (open: boolean) => void;
  onSent?: () => void;
};

export function CandidateFormSendDialog({ open, recipients, onOpenChange, onSent }: Props) {
  const [forms, setForms] = useState<LeadFormOption[]>([]);
  const [formId, setFormId] = useState("");
  const [loadingForms, setLoadingForms] = useState(false);
  const [sending, setSending] = useState(false);
  const uniqueRecipients = useMemo(() => {
    const byId = new Map<string, CandidateFormRecipient>();
    recipients.forEach((recipient) => byId.set(recipient.candidateId, recipient));
    return Array.from(byId.values());
  }, [recipients]);

  useEffect(() => {
    if (!open) return;
    setLoadingForms(true);
    supabase
      .from("lead_forms")
      .select("id, title")
      .eq("status", "active")
      .is("deleted_at", null)
      .order("title", { ascending: true })
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        const nextForms = (data ?? []) as LeadFormOption[];
        setForms(nextForms);
        setFormId((current) => (current && nextForms.some((form) => form.id === current) ? current : nextForms[0]?.id ?? ""));
        setLoadingForms(false);
      });
  }, [open]);

  const send = async () => {
    if (!formId || uniqueRecipients.length === 0 || sending) return;
    setSending(true);
    try {
      const result = await sendCandidateFormInvites(formId, uniqueRecipients.map((recipient) => recipient.candidateId));
      toast.success("Form invitations processed", {
        description: inviteResultDescription(result) || undefined,
      });
      onSent?.();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send form invitations");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !sending && onOpenChange(nextOpen)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Send candidate form
          </DialogTitle>
          <DialogDescription>
            {uniqueRecipients.length} candidate{uniqueRecipients.length === 1 ? "" : "s"} selected. Each candidate gets a unique single-use link.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label>Form</Label>
          <Select value={formId} onValueChange={setFormId} disabled={loadingForms || forms.length === 0}>
            <SelectTrigger>
              <SelectValue placeholder={loadingForms ? "Loading forms..." : "Select a form"} />
            </SelectTrigger>
            <SelectContent>
              {forms.map((form) => (
                <SelectItem key={form.id} value={form.id}>
                  {form.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!loadingForms && forms.length === 0 && (
            <p className="text-sm text-destructive">No active forms are available.</p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button type="button" onClick={send} disabled={!formId || sending || uniqueRecipients.length === 0}>
            <Send className="mr-2 h-4 w-4" />
            {sending ? "Sending..." : "Send form"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
