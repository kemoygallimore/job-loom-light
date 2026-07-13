import type { Dispatch, SetStateAction } from "react";
import { Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FEATURE_LABELS, type Features } from "../types";

type Props = {
  features: Features | null;
  saving: boolean;
  onFeaturesChange: Dispatch<SetStateAction<Features | null>>;
  onSave: () => void;
};

export function FeaturesTab({ features, saving, onFeaturesChange, onSave }: Props) {
  return (
    <div className="rounded-xl border bg-card p-6 space-y-5 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold">Non-core feature toggles</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Enable or disable optional modules for this tenant.
        </p>
      </div>
      <div className="space-y-2">
        {features &&
          FEATURE_LABELS.map(({ key, label, comingSoon }) => (
            <div key={key} className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">{label}</Label>
                {comingSoon && (
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                    Coming soon
                  </Badge>
                )}
              </div>
              <Switch
                checked={features[key]}
                onCheckedChange={(b) => onFeaturesChange({ ...features, [key]: b })}
              />
            </div>
          ))}
      </div>
      <Button onClick={onSave} disabled={saving} className="w-full sm:w-auto">
        <Save className="w-4 h-4 mr-2" /> {saving ? "Saving..." : "Save features"}
      </Button>
    </div>
  );
}
