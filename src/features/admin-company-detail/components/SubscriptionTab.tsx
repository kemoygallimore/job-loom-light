import type { Dispatch, SetStateAction } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cents, toCents, type PlanDefaults, type Subscription } from "../types";

type Props = {
  currency: string;
  defaults: PlanDefaults | null;
  saving: boolean;
  subscription: Subscription;
  onSave: () => void;
  onSubscriptionChange: Dispatch<SetStateAction<Subscription | null>>;
};

export function SubscriptionTab({
  currency,
  defaults,
  saving,
  subscription,
  onSave,
  onSubscriptionChange,
}: Props) {
  const setSubscription = (patch: Partial<Subscription>) => {
    onSubscriptionChange((current) => (current ? { ...current, ...patch } : current));
  };

  return (
    <div className="rounded-xl border bg-card p-6 space-y-5 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold">Plan & overrides</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Leave override fields blank to inherit from master pricing.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Annual price override ({currency})
          </Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            placeholder={defaults ? `Default: ${cents(defaults.annual_price_cents)}` : ""}
            value={cents(subscription.override_annual_price_cents)}
            onChange={(e) => setSubscription({ override_annual_price_cents: toCents(e.target.value) })}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Open jobs override</Label>
          <Input
            type="number"
            min="0"
            placeholder={defaults ? `Default: ${defaults.included_open_jobs}` : ""}
            value={subscription.override_open_jobs ?? ""}
            onChange={(e) =>
              setSubscription({ override_open_jobs: e.target.value === "" ? null : parseInt(e.target.value, 10) })
            }
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">User seats override</Label>
          <Input
            type="number"
            min="0"
            placeholder={defaults ? `Default: ${defaults.included_seats}` : ""}
            value={subscription.override_seats ?? ""}
            onChange={(e) =>
              setSubscription({ override_seats: e.target.value === "" ? null : parseInt(e.target.value, 10) })
            }
          />
        </div>
      </div>

      <div className="border-t pt-5 space-y-4">
        <h3 className="text-sm font-semibold">Discount</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Type</Label>
            <Select
              value={subscription.discount_type ?? "none"}
              onValueChange={(v) =>
                setSubscription({
                  discount_type: v === "none" ? null : v,
                  discount_value: v === "none" ? null : subscription.discount_value,
                })
              }
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No discount</SelectItem>
                <SelectItem value="percent">Percent (%)</SelectItem>
                <SelectItem value="fixed">Fixed amount ({currency})</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Value</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              disabled={!subscription.discount_type}
              value={subscription.discount_value ?? ""}
              onChange={(e) =>
                setSubscription({ discount_value: e.target.value === "" ? null : parseFloat(e.target.value) })
              }
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Internal note</Label>
          <Input
            placeholder="e.g. Founders' partner deal"
            value={subscription.discount_note ?? ""}
            onChange={(e) => setSubscription({ discount_note: e.target.value || null })}
          />
        </div>
      </div>

      <Button onClick={onSave} disabled={saving} className="w-full sm:w-auto">
        <Save className="w-4 h-4 mr-2" /> {saving ? "Saving..." : "Save subscription"}
      </Button>
    </div>
  );
}
