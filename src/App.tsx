import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useParams } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Auth from "./pages/Auth";
import AppLayout from "./components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Jobs from "./pages/Jobs";
import Candidates from "./pages/Candidates";
import CandidateProfile from "./pages/CandidateProfile";
import Pipeline from "./pages/Pipeline";
import Assessment from "./pages/Assessment";
import AdminDashboard from "./pages/AdminDashboard";
import AdminOverview from "./pages/admin/AdminOverview";
import AdminCompanies from "./pages/admin/AdminCompanies";
import CareersPage from "./pages/careers/CareersPage";
import JobDetailsPage from "./pages/careers/JobDetailsPage";
import ScreeningJobs from "./pages/screening/ScreeningJobs";
import ScreeningSubmissions from "./pages/screening/ScreeningSubmissions";
import PublicScreening from "./pages/screening/PublicScreening";
import PublicJobApplication from "./pages/apply/PublicJobApplication";
import NotFound from "./pages/NotFound";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";


const queryClient = new QueryClient();
const TEST_ADMIN_EMAIL = "testadmin@email.com";

function ProtectedRoutes() {
  const { user, loading, profile, role } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="relative h-10 w-10">
            <div className="absolute inset-0 rounded-full border-[3px] border-muted" />
            <div className="absolute inset-0 rounded-full border-[3px] border-t-primary animate-spin" />
          </div>
          <p className="text-sm text-muted-foreground animate-pulse">Loading your workspace…</p>
        </div>
      </div>
    );
  }

  if (!user || (!profile && !loading)) return <Navigate to="/auth" replace />;

  return <AppLayout />;
}

function ATSGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (profile?.email !== TEST_ADMIN_EMAIL) {
    return <Navigate to="/screening" replace />;
  }
  return <>{children}</>;
}

function DefaultRedirect() {
  const { profile } = useAuth();
  if (profile?.email === TEST_ADMIN_EMAIL) {
    return <Dashboard />;
  }
  return <Navigate to="/screening" replace />;
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
    const redirectTo = profile?.email === TEST_ADMIN_EMAIL ? "/dashboard" : "/screening";
    return <Navigate to={redirectTo} replace />;
  }
  return <Auth />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/auth" replace />} />
            <Route path="/auth" element={<AuthRoute />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/careers/:companySlug" element={<LegacyCareersRedirect />} />
            <Route path="/careers/:companySlug/:jobId" element={<LegacyJobRedirect />} />
            <Route path="/:companySlug/careers" element={<CareersPage />} />
            <Route path="/:companySlug/careers/:jobId" element={<JobDetailsPage />} />
            <Route path="/screen/:linkId" element={<PublicScreening />} />
            <Route path="/apply/:jobId" element={<PublicJobApplication />} />
            <Route element={<ProtectedRoutes />}>
              <Route path="/dashboard" element={<DefaultRedirect />} />
              <Route path="/jobs" element={<ATSGuard><Jobs /></ATSGuard>} />
              <Route path="/candidates" element={<ATSGuard><Candidates /></ATSGuard>} />
              <Route path="/candidates/:id" element={<ATSGuard><CandidateProfile /></ATSGuard>} />
              <Route path="/pipeline" element={<ATSGuard><Pipeline /></ATSGuard>} />
              <Route path="/screening" element={<ScreeningJobs />} />
              <Route path="/screening/:jobId/submissions" element={<ScreeningSubmissions />} />
              <Route path="/assessment" element={<Assessment />} />
              <Route path="/admin" element={<AdminDashboard />}>
                <Route index element={<AdminOverview />} />
                <Route path="companies" element={<AdminCompanies />} />
              </Route>
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
