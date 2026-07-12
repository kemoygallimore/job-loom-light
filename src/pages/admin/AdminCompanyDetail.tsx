import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  getAdminCompanyDetail,
  insertAddon,
  removeAddon,
  setAddonActive,
  updateCompany,
  upsertFeatures,
  upsertSubscription,
} from "@/features/admin-company-detail/api";
import { AddonsTab } from "@/features/admin-company-detail/components/AddonsTab";
import { BillingTab, EmailDomainTab, UsersTab } from "@/features/admin-company-detail/components/CompanyBillingTabs";
import { CompanyHeader } from "@/features/admin-company-detail/components/CompanyHeader";
import { EditCompanyDialog } from "@/features/admin-company-detail/components/EditCompanyDialog";
import { FeaturesTab } from "@/features/admin-company-detail/components/FeaturesTab";
import { SubscriptionTab } from "@/features/admin-company-detail/components/SubscriptionTab";
import {
  toCents,
  type Addon,
  type CompanySummary,
  type Features,
  type PlanDefaults,
  type Subscription,
} from "@/features/admin-company-detail/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function messageFromError(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return fallback;
}

function defaultAddonPrice(defaults: PlanDefaults | null, addonType: string) {
  if (!defaults) return 0;
  switch (addonType) {
    case "extra_jobs_pack5": return defaults.addon_price_extra_jobs_pack5_cents;
    case "extra_seats_pack2": return defaults.addon_price_extra_seats_pack2_cents;
    case "email_notifications": return defaults.addon_price_email_notifications_cents;
    case "custom_email_domain": return defaults.addon_price_custom_email_domain_cents;
    default: return 0;
  }
}

export default function AdminCompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const [company, setCompany] = useState<CompanySummary | null>(null);
  const [defaults, setDefaults] = useState<PlanDefaults | null>(null);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [features, setFeatures] = useState<Features | null>(null);
  const [savingFeatures, setSavingFeatures] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editStatus, setEditStatus] = useState("active");
  const [editBusy, setEditBusy] = useState(false);
  const [jobLimit, setJobLimit] = useState<number | null>(null);
  const [seatLimit, setSeatLimit] = useState<number | null>(null);
  const [newType, setNewType] = useState<string>("extra_jobs_pack5");
  const [newQty, setNewQty] = useState<string>("1");
  const [newPrice, setNewPrice] = useState<string>("");

  const refresh = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const data = await getAdminCompanyDetail(id);
    setCompany(data.company);
    setDefaults(data.defaults);
    setSub(data.subscription);
    setAddons(data.addons);
    setFeatures(data.features);
    setJobLimit(data.jobLimit);
    setSeatLimit(data.seatLimit);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const openEdit = () => {
    setEditName(company?.name ?? "");
    setEditStatus(company?.status ?? "active");
    setEditOpen(true);
  };

  const saveCompany = async () => {
    if (!id || !editName.trim()) {
      toast.error("Name is required");
      return;
    }
    setEditBusy(true);
    try {
      await updateCompany(id, editName.trim(), editStatus);
      toast.success("Company updated");
      setEditOpen(false);
      refresh();
    } catch (error: unknown) {
      toast.error(messageFromError(error, "Could not update company"));
    } finally {
      setEditBusy(false);
    }
  };

  const saveSubscription = async () => {
    if (!sub || !id) return;
    setSaving(true);
    try {
      await upsertSubscription(id, sub);
      toast.success("Subscription saved");
      refresh();
    } catch (error: unknown) {
      toast.error(messageFromError(error, "Could not save subscription"));
    } finally {
      setSaving(false);
    }
  };

  const saveFeatures = async () => {
    if (!features || !id) return;
    setSavingFeatures(true);
    try {
      await upsertFeatures(id, features);
      toast.success("Features updated");
      refresh();
    } catch (error: unknown) {
      toast.error(messageFromError(error, "Could not save features"));
    } finally {
      setSavingFeatures(false);
    }
  };

  const addAddon = async () => {
    if (!id) return;
    const qty = parseInt(newQty, 10);
    if (Number.isNaN(qty) || qty < 1) {
      toast.error("Quantity must be at least 1");
      return;
    }
    const unit = toCents(newPrice) ?? defaultAddonPrice(defaults, newType);
    try {
      await insertAddon(id, newType, qty, unit);
      toast.success("Add-on added");
      setNewQty("1");
      setNewPrice("");
      refresh();
    } catch (error: unknown) {
      toast.error(messageFromError(error, "Could not add add-on"));
    }
  };

  const toggleAddon = async (addon: Addon) => {
    try {
      await setAddonActive(addon.id, !addon.active);
      refresh();
    } catch (error: unknown) {
      toast.error(messageFromError(error, "Could not update add-on"));
    }
  };

  const deleteAddon = async (addon: Addon) => {
    if (!confirm("Remove this add-on?")) return;
    try {
      await removeAddon(addon.id);
      toast.success("Add-on removed");
      refresh();
    } catch (error: unknown) {
      toast.error(messageFromError(error, "Could not remove add-on"));
    }
  };

  if (loading || !sub) {
    return <div className="p-12 text-center text-muted-foreground">Loading...</div>;
  }

  const currency = defaults?.currency ?? "USD";

  return (
    <div className="space-y-6">
      <CompanyHeader company={company} jobLimit={jobLimit} seatLimit={seatLimit} onEdit={openEdit} />

      <Tabs defaultValue="subscription" className="animate-fade-in" style={{ animationDelay: "80ms" }}>
        <TabsList>
          <TabsTrigger value="subscription">Subscription</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="addons">Add-ons</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="email-domain">Email Domain</TabsTrigger>
        </TabsList>

        <TabsContent value="subscription" className="space-y-6 mt-6">
          <SubscriptionTab
            currency={currency}
            defaults={defaults}
            saving={saving}
            subscription={sub}
            onSave={saveSubscription}
            onSubscriptionChange={setSub}
          />
        </TabsContent>

        <TabsContent value="features" className="space-y-6 mt-6">
          <FeaturesTab
            features={features}
            saving={savingFeatures}
            onFeaturesChange={setFeatures}
            onSave={saveFeatures}
          />
        </TabsContent>

        <TabsContent value="addons" className="space-y-6 mt-6">
          <AddonsTab
            addons={addons}
            currency={currency}
            newPrice={newPrice}
            newQty={newQty}
            newType={newType}
            onAddAddon={addAddon}
            onDeleteAddon={deleteAddon}
            onNewPriceChange={setNewPrice}
            onNewQtyChange={setNewQty}
            onNewTypeChange={setNewType}
            onToggleAddon={toggleAddon}
          />
        </TabsContent>

        <TabsContent value="billing" className="space-y-6 mt-6">
          {id && <BillingTab companyId={id} />}
        </TabsContent>

        <TabsContent value="email-domain" className="space-y-6 mt-6">
          {id && <EmailDomainTab companyId={id} />}
        </TabsContent>

        <TabsContent value="users" className="space-y-6 mt-6">
          {id && <UsersTab companyId={id} seatLimit={seatLimit} />}
        </TabsContent>
      </Tabs>

      <EditCompanyDialog
        busy={editBusy}
        name={editName}
        open={editOpen}
        status={editStatus}
        onNameChange={setEditName}
        onOpenChange={setEditOpen}
        onSave={saveCompany}
        onStatusChange={setEditStatus}
      />
    </div>
  );
}
