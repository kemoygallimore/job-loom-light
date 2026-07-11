import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowRightLeft, MessageSquarePlus, FileText, History } from "lucide-react";
import { getSignedVideoViewUrl } from "@/lib/getSignedVideoViewUrl";
import { R2_BUCKET_RESUMES } from "@/lib/r2Worker";
import { useNavigate } from "react-router-dom";
import { PIPELINE_STAGES, STAGE_LABELS } from "@/lib/stages";

interface CandidateQuickActionsProps {
  candidateId: string;
  companyId: string;
  userId: string;
  latestAppId: string | null;
  latestStage: string | null;
  resumeUrl: string | null;
  resumeBucket: string | null;
  resumeObjectKey: string | null;
  onStageChanged: () => void;
  onNoteAdded: () => void;
  hideStageChange?: boolean;
}

export default function CandidateQuickActions({
  candidateId, companyId, userId, latestAppId, latestStage, resumeUrl,
  resumeBucket, resumeObjectKey, onStageChanged, onNoteAdded, hideStageChange,
}: CandidateQuickActionsProps) {
  const navigate = useNavigate();
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [saving, setSaving] = useState(false);

  const handleStageChange = async (newStage: string) => {
    if (!latestAppId) return;
    const { error } = await supabase.from("applications").update({ stage: newStage as any }).eq("id", latestAppId);
    if (error) { toast.error(error.message); return; }
    toast.success(`Moved to ${newStage}`);
    onStageChanged();
  };

  const handleAddNote = async () => {
    if (!noteContent.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("notes").insert({
      candidate_id: candidateId,
      company_id: companyId,
      user_id: userId,
      content: noteContent.trim(),
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Note added");
    setNoteContent("");
    setNoteOpen(false);
    onNoteAdded();
  };

  return (
    <>
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        {/* Move stage */}
        {!hideStageChange && latestAppId && (
          <Select value={latestStage ?? undefined} onValueChange={handleStageChange}>
            <SelectTrigger className="w-8 h-8 p-0 border-none shadow-none [&>svg]:hidden [&>span]:hidden">
              <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                <span><ArrowRightLeft className="w-3.5 h-3.5" /></span>
              </Button>
            </SelectTrigger>
            <SelectContent>
              {PIPELINE_STAGES.map((s) => (
                <SelectItem key={s} value={s} className="text-xs">{STAGE_LABELS[s] ?? s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Add note */}
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setNoteOpen(true)}>
          <MessageSquarePlus className="w-3.5 h-3.5" />
        </Button>

        {/* View resume */}
        {(resumeObjectKey || resumeUrl) && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={async () => {
              try {
                const key = resumeObjectKey || resumeUrl!;
                const bucket = resumeBucket || R2_BUCKET_RESUMES;
                const accessToken = (await supabase.auth.getSession()).data.session?.access_token;
                const viewUrl = await getSignedVideoViewUrl(bucket, key, accessToken);
                window.open(viewUrl, "_blank");
              } catch {
                toast.error("Failed to load resume");
              }
            }}
          >
            <FileText className="w-3.5 h-3.5" />
          </Button>
        )}

        {/* View profile / history */}
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/candidates/${candidateId}`)}>
          <History className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Quick note dialog */}
      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader><DialogTitle>Quick Note</DialogTitle></DialogHeader>
          <Textarea
            placeholder="Add a note about this candidate..."
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            rows={3}
          />
          <Button onClick={handleAddNote} disabled={saving || !noteContent.trim()} className="w-full">
            {saving ? "Saving…" : "Save Note"}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
