import CompanyEmailDomainTab from "@/components/admin/CompanyEmailDomainTab";
import CompanyUsersTab from "@/components/admin/CompanyUsersTab";
import BillingCycleCard from "@/components/billing/BillingCycleCard";
import BillingProfileForm from "@/components/billing/BillingProfileForm";
import CompanyInvoicesCard from "@/components/billing/CompanyInvoicesCard";

type BillingProps = {
  companyId: string;
};

type UsersProps = {
  companyId: string;
  seatLimit: number | null;
};

export function BillingTab({ companyId }: BillingProps) {
  return (
    <>
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
