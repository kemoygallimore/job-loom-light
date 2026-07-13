import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useParams } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Auth from "./pages/Auth";
import AppLayout from "./components/AppLayout";
import NotFound from "./pages/NotFound";
import ErrorBoundary from "./components/ErrorBoundary";
import FullPageLoader from "./components/FullPageLoader";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Jobs = lazy(() => import("./pages/Jobs"));
const Candidates = lazy(() => import("./pages/Candidates"));
const CandidateProfile = lazy(() => import("./pages/CandidateProfile"));
const Pipeline = lazy(() => import("./pages/Pipeline"));
const Assessment = lazy(() => import("./pages/Assessment"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminOverview = lazy(() => import("./pages/admin/AdminOverview"));
const AdminCompanies = lazy(() => import("./pages/admin/AdminCompanies"));
const AdminPricing = lazy(() => import("./pages/admin/AdminPricing"));
const AdminCompanyDetail = lazy(() => import("./pages/admin/AdminCompanyDetail"));
const CandidateTagsAdmin = lazy(() => import("./pages/admin/CandidateTagsAdmin"));
const AdminInvoiceDetail = lazy(() => import("./pages/admin/AdminInvoiceDetail"));
const AdminBilling = lazy(() => import("./pages/admin/AdminBilling"));
const AdminEmailTemplates = lazy(() => import("./pages/admin/AdminEmailTemplates"));
const AdminPolicies = lazy(() => import("./pages/admin/AdminPolicies"));
const Billing = lazy(() => import("./pages/Billing"));
const Team = lazy(() => import("./pages/Team"));
const Forms = lazy(() => import("./pages/Forms"));
const CompanyEmailTemplates = lazy(() => import("./pages/settings/CompanyEmailTemplates"));
const CompanyDataProtection = lazy(() => import("./pages/settings/CompanyDataProtection"));
const InvoiceDetail = lazy(() => import("./pages/InvoiceDetail"));
const CareersPage = lazy(() => import("./pages/careers/CareersPage"));
const JobDetailsPage = lazy(() => import("./pages/careers/JobDetailsPage"));
const ScreeningJobs = lazy(() => import("./pages/screening/ScreeningJobs"));
const ScreeningSubmissions = lazy(() => import("./pages/screening/ScreeningSubmissions"));
const PublicScreening = lazy(() => import("./pages/screening/PublicScreening"));
const PublicJobApplication = lazy(() => import("./pages/apply/PublicJobApplication"));
const PublicFeedback = lazy(() => import("./pages/feedback/PublicFeedback"));
const FormBuilder = lazy(() => import("./pages/forms/FormBuilder"));
const FormSubmissions = lazy(() => import("./pages/forms/FormSubmissions"));
const CandidateAssignedForm = lazy(() => import("./pages/forms/CandidateAssignedForm"));
const DataProtection = lazy(() => import("./pages/legal/DataProtection"));
const CompanyPolicy = lazy(() => import("./pages/legal/CompanyPolicy"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function ProtectedRoutes() {
  const { user, loading, profile } = useAuth();

  if (loading) {
    return <FullPageLoader />;
  }

  if (!user || (!profile && !loading)) return <Navigate to="/auth" replace />;

  return <AppLayout />;
}

function LegacyCareersRedirect() {
  const { companySlug } = useParams<{ companySlug: string }>();
  return <Navigate to={`/${companySlug}/careers`} replace />;
}

function LegacyJobRedirect() {
  const { companySlug, jobId } = useParams<{ companySlug: string; jobId: string }>();
  return <Navigate to={`/${companySlug}/careers/${jobId}`} replace />;
}

function AuthRoute() {
  const { user, loading, profile, role } = useAuth();
  if (loading) return null;
  if (user && (profile || role === "super_admin")) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Auth />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ErrorBoundary>
            <Suspense fallback={<FullPageLoader />}>
              <Routes>
                <Route path="/" element={<Navigate to="/auth" replace />} />
                <Route path="/auth" element={<AuthRoute />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/careers/:companySlug" element={<LegacyCareersRedirect />} />
                <Route path="/careers/:companySlug/:jobId" element={<LegacyJobRedirect />} />
                <Route path="/:companySlug/careers" element={<CareersPage />} />
                <Route path="/:companySlug/careers/:jobId" element={<JobDetailsPage />} />
                <Route path="/:companySlug/legal/candidate-privacy" element={<CompanyPolicy />} />
                <Route path="/screen/:linkId" element={<PublicScreening />} />
                <Route path="/apply/:jobId" element={<PublicJobApplication />} />
                <Route path="/feedback/:token" element={<PublicFeedback />} />
                <Route path="/candidate-form/:token" element={<CandidateAssignedForm />} />
                <Route path="/legal/data-protection" element={<DataProtection />} />
                <Route element={<ProtectedRoutes />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/jobs" element={<Jobs />} />
                  <Route path="/candidates" element={<Candidates />} />
                  <Route path="/candidates/:id" element={<CandidateProfile />} />
                  <Route path="/pipeline" element={<Pipeline />} />
                  <Route path="/admin/candidate-tags" element={<CandidateTagsAdmin />} />
                  <Route path="/screening" element={<ScreeningJobs />} />
                  <Route path="/screening/:jobId/submissions" element={<ScreeningSubmissions />} />
                  <Route path="/assessment" element={<Assessment />} />
                  <Route path="/billing" element={<Billing />} />
                  <Route path="/billing/invoices/:id" element={<InvoiceDetail />} />
                  <Route path="/team" element={<Team />} />
                  <Route path="/forms" element={<Forms />} />
                  <Route path="/forms/new" element={<FormBuilder />} />
                  <Route path="/forms/:formId/edit" element={<FormBuilder />} />
                  <Route path="/forms/:formId/submissions" element={<FormSubmissions />} />
                  <Route path="/settings/email-templates" element={<CompanyEmailTemplates />} />
                  <Route path="/settings/data-protection" element={<CompanyDataProtection />} />
                  <Route path="/admin" element={<AdminDashboard />}>
                    <Route index element={<AdminOverview />} />
                    <Route path="companies" element={<AdminCompanies />} />
                    <Route path="companies/:id" element={<AdminCompanyDetail />} />
                    <Route path="pricing" element={<AdminPricing />} />
                    <Route path="billing" element={<AdminBilling />} />
                    <Route path="billing/invoices/:id" element={<AdminInvoiceDetail />} />
                    <Route path="email-templates" element={<AdminEmailTemplates />} />
                    <Route path="policies" element={<AdminPolicies />} />
                  </Route>
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
