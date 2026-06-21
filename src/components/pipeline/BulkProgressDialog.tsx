import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface Props {
  bulkActionId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export default function BulkProgressDialog({ bulkActionId, isOpen, onClose, onComplete }: Props) {
  const { profile } = useAuth();
  const [status, setStatus] = useState<string | null>(null);
  const [processed, setProcessed] = useState<number>(0);
  const [total, setTotal] = useState<number>(0);
  const [errors, setErrors] = useState<number>(0);

  useEffect(() => {
    if (!isOpen || !bulkActionId || !profile) return;

    let mounted = true;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const fetchStatus = async () => {
      try {
        const { data, error } = await supabase
          .from("bulk_actions")
          .select("id, status, processed_count, total_count, error_count, started_at, finished_at")
          .eq("id", bulkActionId)
          .eq("company_id", profile.company_id)
          .maybeSingle();
        if (error) {
          console.error("bulk progress fetch error", error);
          return;
        }
        if (!mounted || !data) return;
        setStatus((data as any).status ?? null);
        setProcessed((data as any).processed_count ?? 0);
        setTotal((data as any).total_count ?? 0);
        setErrors((data as any).error_count ?? 0);

        if ((data as any).status === "completed") {
          if (intervalId) clearInterval(intervalId);
          if (onComplete) onComplete();
        }
        if ((data as any).status === "failed") {
          if (intervalId) clearInterval(intervalId);
          toast.error("Bulk action failed. Check the audit logs.");
          if (onComplete) onComplete();
        }
      } catch (err) {
        console.error(err);
      }
    };

    fetchStatus();
    intervalId = setInterval(fetchStatus, 3000);

    return () => {
      mounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [bulkActionId, isOpen, profile, onComplete]);

  const percent = total > 0 ? Math.round((processed / total) * 100) : 0;

  const handleUndo = async () => {
    if (!bulkActionId || !profile) return;
    try {
      const { data, error } = await supabase.functions.invoke("undo-bulk-action", {
        body: { bulk_action_id: bulkActionId, company_id: profile.company_id },
      });
      if (error) {
        toast.error(error.message || "Undo failed");
        return;
      }
      const reverted = (data as any)?.reverted_count ?? 0;
      toast.success(`Reverted ${reverted} applications`);
      if (onComplete) onComplete();
    } catch (err: any) {
      toast.error(err?.message ?? "Undo failed");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bulk action status</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium">Status: <span className="font-semibold">{status ?? 'pending'}</span></div>
              <div className="text-xs text-muted-foreground">Processed {processed} of {total}</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium">{percent}%</div>
              <div className="text-xs text-muted-foreground">Errors: {errors}</div>
            </div>
          </div>
          <div className="mt-3">
            <Progress value={percent} />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onClose()}>Close</Button>
            <Button onClick={handleUndo} disabled={status !== "completed"}>Undo</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
