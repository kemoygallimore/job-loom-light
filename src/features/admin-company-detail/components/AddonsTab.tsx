import { Plus, Trash2 } from "lucide-react";
import { ADDON_LABELS, cents, type Addon } from "../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Props = {
  addons: Addon[];
  currency: string;
  newPrice: string;
  newQty: string;
  newType: string;
  onAddAddon: () => void;
  onDeleteAddon: (addon: Addon) => void;
  onNewPriceChange: (price: string) => void;
  onNewQtyChange: (quantity: string) => void;
  onNewTypeChange: (type: string) => void;
  onToggleAddon: (addon: Addon) => void;
};

export function AddonsTab({
  addons,
  currency,
  newPrice,
  newQty,
  newType,
  onAddAddon,
  onDeleteAddon,
  onNewPriceChange,
  onNewQtyChange,
  onNewTypeChange,
  onToggleAddon,
}: Props) {
  return (
    <>
      <div className="rounded-xl border bg-card p-6 space-y-4 max-w-3xl">
        <h2 className="text-lg font-semibold">Add a new add-on</h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Type</Label>
            <Select value={newType} onValueChange={onNewTypeChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(ADDON_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Qty</Label>
            <Input type="number" min="1" value={newQty} onChange={(e) => onNewQtyChange(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Unit price ({currency})
            </Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="Use default"
              value={newPrice}
              onChange={(e) => onNewPriceChange(e.target.value)}
            />
          </div>
        </div>
        <Button onClick={onAddAddon}><Plus className="w-4 h-4 mr-2" /> Add add-on</Button>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden max-w-3xl">
        {addons.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            No add-ons yet for this tenant.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Type</TableHead>
                <TableHead className="text-center">Qty</TableHead>
                <TableHead className="text-right">Unit price</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead className="text-center">Active</TableHead>
                <TableHead className="w-[1%]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {addons.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium text-sm">{ADDON_LABELS[a.addon_type] ?? a.addon_type}</TableCell>
                  <TableCell className="text-center tabular-nums">{a.quantity}</TableCell>
                  <TableCell className="text-right tabular-nums">{cents(a.unit_price_cents)}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {cents(a.unit_price_cents * a.quantity)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch checked={a.active} onCheckedChange={() => onToggleAddon(a)} />
                  </TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onDeleteAddon(a)}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </>
  );
}
