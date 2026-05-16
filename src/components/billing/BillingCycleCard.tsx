import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Save, CalendarClock } from "lucide-react";

interface Cycle {
  subscription_start_date: string;
  renewal_date: string;
  auto_renew: boolean;
}

interface Props {
  companyId: string;
  canEdit: boolean;
}

function daysUntil(date: string | null | undefined): number | null {
  if (!date) return null;
  const ms = new Date(date + "T00:00:00").getTime() - new Date().setHours(0, 0, 0, 0);
  return Math.round(ms / 86400000);
}

export default function BillingCycleCard({ companyId, canEdit }: Props) {
  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("company_subscriptions" as any)
      .select("subscription_start_date, renewal_date, auto_renew")
      .eq("company_id", companyId)
      .maybeSingle();
    if (error) toast.error(error.message);
    setCycle((data as any) ?? null);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const save = async (patch: Partial<Cycle>) => {
    if (!cycle) return;
    setSaving(true);
    const { error } = await supabase
      .from("company_subscriptions" as any)
      .update(patch)
      .eq("company_id", companyId);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Billing cycle updated");
    setEditing(false);
    load();
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading cycle…</div>;
  }
  if (!cycle) {
    return <div className="text-sm text-muted-foreground">No subscription record yet.</div>;
  }

  const days = daysUntil(cycle.renewal_date);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-base font-semibold">Billing cycle</h3>
        </div>
        {canEdit && !editing && (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Edit dates</Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Start date</Label>
          {editing ? (
            <Input
              type="date"
              value={cycle.subscription_start_date}
              onChange={(e) => setCycle({ ...cycle, subscription_start_date: e.target.value })}
            />
          ) : (
            <div className="text-sm font-medium tabular-nums">{cycle.subscription_start_date}</div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Renewal date</Label>
          {editing ? (
            <Input
              type="date"
              value={cycle.renewal_date}
              onChange={(e) => setCycle({ ...cycle, renewal_date: e.target.value })}
            />
          ) : (
            <div className="text-sm font-medium tabular-nums">{cycle.renewal_date}</div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Days until renewal</Label>
          <div>
            {days == null ? (
              <span className="text-sm text-muted-foreground">—</span>
            ) : (
              <Badge variant={days < 0 ? "destructive" : days <= 30 ? "default" : "secondary"}>
                {days < 0 ? `${Math.abs(days)} days overdue` : `${days} days`}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <Label className="text-sm font-medium">Auto-renew</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Automatically generate the next invoice 30 days before renewal.
          </p>
        </div>
        <Switch
          checked={cycle.auto_renew}
          disabled={!canEdit || saving}
          onCheckedChange={(b) => save({ auto_renew: b })}
        />
      </div>

      {editing && (
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() =>
              save({
                subscription_start_date: cycle.subscription_start_date,
                renewal_date: cycle.renewal_date,
              })
            }
            disabled={saving}
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Saving…" : "Save dates"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setEditing(false); load(); }}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}