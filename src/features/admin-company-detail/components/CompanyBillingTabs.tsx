import CompanyEmailDomainTab from "@/components/admin/CompanyEmailDomainTab";
import CompanyUsersTab from "@/components/admin/CompanyUsersTab";
import BillingCycleCard from "@/components/billing/BillingCycleCard";
import BillingProfileForm from "@/components/billing/BillingProfileForm";
import CompanyInvoicesCard from "@/components/billing/CompanyInvoicesCard";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { missingBillingFields } from "@/lib/billingProfile";
import type { AdminBillingProfileRow, AdminInvoiceRow } from "@/lib/adminConsole";
import { ADDON_LABELS, cents, type Addon, type PlanDefaults, type Subscription } from "../types";

type BillingProps = {
  addons: Addon[];
  billingProfile: AdminBillingProfileRow | null;
  companyId: string;
  defaults: PlanDefaults | null;
  invoices: AdminInvoiceRow[];
  jobLimit: number | null;
  seatLimit: number | null;
  subscription: Subscription;
};

type UsersProps = {
  companyId: string;
  seatLimit: number | null;
};

function discountAmount(baseCents: number, subscription: Subscription) {
  if (!subscription.discount_type || subscription.discount_value == null) return 0;
  if (subscription.discount_type === "percent") return Math.round(baseCents * (subscription.discount_value / 100));
  return Math.round(subscription.discount_value);
}

export function BillingTab({
  addons,
  billingProfile,
  companyId,
  defaults,
  invoices,
  jobLimit,
  seatLimit,
  subscription,
}: BillingProps) {
  const activeAddons = addons.filter((addon) => addon.active);
  const inactiveAddons = addons.length - activeAddons.length;
  const baseAnnualCents = subscription.override_annual_price_cents ?? defaults?.annual_price_cents ?? 0;
  const addOnAnnualCents = activeAddons.reduce((sum, addon) => sum + addon.unit_price_cents * addon.quantity, 0);
  const discountCents = Math.min(baseAnnualCents + addOnAnnualCents, discountAmount(baseAnnualCents, subscription));
  const estimatedAnnualCents = Math.max(0, baseAnnualCents + addOnAnnualCents - discountCents);
  const overdueInvoices = invoices.filter((invoice) => {
    const dueAt = invoice.due_at ? new Date(invoice.due_at).getTime() : null;
    return invoice.status !== "paid" && invoice.status !== "void" && dueAt != null && dueAt < Date.now() && !invoice.paid_at;
  });
  const missingFields = missingBillingFields(billingProfile);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Billing context</CardTitle>
            <p className="text-sm text-muted-foreground">
              Commercial snapshot for support, renewal, and expansion decisions.
            </p>
          </div>
          <Badge variant={missingFields.length ? "destructive" : "secondary"}>
            {missingFields.length ? "Profile incomplete" : "Billing ready"}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="rounded-lg border p-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Estimated annual</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{cents(estimatedAnnualCents)}</div>
              <p className="text-xs text-muted-foreground">Base, active add-ons, and discount</p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Active add-ons</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{activeAddons.length}</div>
              <p className="text-xs text-muted-foreground">{inactiveAddons} inactive</p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Limits</div>
              <div className="mt-1 text-sm font-semibold tabular-nums">{jobLimit ?? "—"} jobs / {seatLimit ?? "—"} seats</div>
              <p className="text-xs text-muted-foreground">Includes subscription overrides</p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Revenue risk</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{overdueInvoices.length}</div>
              <p className="text-xs text-muted-foreground">Overdue invoice{overdueInvoices.length === 1 ? "" : "s"}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">Plan and renewal</h3>
                  <p className="text-xs text-muted-foreground">Use this to sanity-check invoice setup before support actions.</p>
                </div>
                <Badge variant={subscription.override_annual_price_cents != null ? "outline" : "secondary"}>
                  {subscription.override_annual_price_cents != null ? "Custom price" : "Default price"}
                </Badge>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">Base annual</dt>
                  <dd className="font-medium tabular-nums">{cents(baseAnnualCents)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">Add-ons</dt>
                  <dd className="font-medium tabular-nums">{cents(addOnAnnualCents)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">Discount</dt>
                  <dd className="font-medium tabular-nums">{discountCents ? `-${cents(discountCents)}` : "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">Renewal</dt>
                  <dd className="font-medium">{subscription.renewal_date ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">Auto-renew</dt>
                  <dd className="font-medium">{subscription.auto_renew === false ? "Off" : subscription.auto_renew === true ? "On" : "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">Currency</dt>
                  <dd className="font-medium">{defaults?.currency ?? "USD"}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-xl border p-4 space-y-3">
              <div>
                <h3 className="text-sm font-semibold">Add-on context</h3>
                <p className="text-xs text-muted-foreground">Active items are included in the estimated annual total.</p>
              </div>
              {activeAddons.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active add-ons. This tenant is on base-plan capacity only.</p>
              ) : (
                <div className="space-y-2">
                  {activeAddons.map((addon) => (
                    <div key={addon.id} className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2 text-sm">
                      <span className="font-medium">{ADDON_LABELS[addon.addon_type] ?? addon.addon_type}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {addon.quantity} x {cents(addon.unit_price_cents)} = {cents(addon.unit_price_cents * addon.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {missingFields.length > 0 && (
                <div className="rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">
                  Missing billing profile fields: {missingFields.join(", ")}.
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="rounded-xl border bg-card p-6 max-w-3xl">
        <BillingProfileForm companyId={companyId} canEdit />
      </div>
      <div className="rounded-xl border bg-card p-6 max-w-3xl">
        <BillingCycleCard companyId={companyId} canEdit />
      </div>
      <div className="rounded-xl border bg-card p-6">
        <CompanyInvoicesCard companyId={companyId} />
      </div>
    </>
  );
}

export function EmailDomainTab({ companyId }: BillingProps) {
  return <CompanyEmailDomainTab companyId={companyId} />;
}

export function UsersTab({ companyId, seatLimit }: UsersProps) {
  return <CompanyUsersTab companyId={companyId} seatLimit={seatLimit} />;
}
