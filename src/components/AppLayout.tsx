import { Link, useLocation, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Users,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu,
  Shield,
  X,
  ChevronLeft,
  Building2,
  Video,
  ClipboardCheck,
  Tags,
  Briefcase,
  DollarSign,
  Receipt,
  Mail,
  ChevronUp,
  FileText,
  ClipboardList,
} from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import rizonhireLogoWhite from "@/assets/RIZONHire_logo_White.png";
import rizonhireLogoBlack from "@/assets/RIZONHire_logo_Black.png";
import rizonhireLogoBlue from "@/assets/rizonhire blue logo.png";

const atsNavItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/jobs", label: "Jobs", icon: Briefcase },
  { to: "/candidates", label: "Candidates", icon: Users },
  { to: "/pipeline", label: "Pipeline", icon: FolderKanban },
  { to: "/forms", label: "Forms", icon: ClipboardList },
  { to: "/admin/candidate-tags", label: "Candidate Tags", icon: Tags },
];

const screeningNavItems = [{ to: "/screening", label: "Video Screening", icon: Video }];

const assessmentNavItem = { to: "/assessment", label: "Assessment", icon: ClipboardCheck };

const superAdminNav = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard },
  { to: "/admin/companies", label: "Companies", icon: Building2 },
  { to: "/admin/pricing", label: "Pricing", icon: DollarSign },
  { to: "/admin/billing", label: "Billing", icon: Receipt },
  { to: "/admin/email-templates", label: "Email Templates", icon: Mail },
  { to: "/admin/policies", label: "Policies", icon: FileText },
];

export default function AppLayout() {
  const { profile, role, signOut } = useAuth();
  const { flags } = useFeatureFlags();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [suspended, setSuspended] = useState(false);
  const [companyChecked, setCompanyChecked] = useState(false);

  const isSuperAdmin = role === "super_admin";

  useEffect(() => {
    if (isSuperAdmin || !profile?.company_id) {
      setCompanyChecked(true);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("companies")
        .select("status")
        .eq("id", profile.company_id)
        .maybeSingle();
      setSuspended(data?.status === "suspended");
      setCompanyChecked(true);
    })();
  }, [isSuperAdmin, profile?.company_id]);

  if (!isSuperAdmin && companyChecked && suspended) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="max-w-md w-full text-center space-y-5 rounded-2xl border bg-card p-8 shadow-sm">
          <div className="w-12 h-12 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
            <Shield className="w-6 h-6 text-destructive" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Account suspended</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Your workspace is currently suspended. Please contact your account administrator to restore access.
            </p>
          </div>
          <Button variant="outline" onClick={signOut} className="w-full">
            <LogOut className="w-4 h-4 mr-2" /> Sign out
          </Button>
        </div>
      </div>
    );
  }

  const topLinks = isSuperAdmin ? superAdminNav : [...atsNavItems, ...screeningNavItems];
  const tenantBottom = flags.assessment ? [assessmentNavItem] : [];
  const bottomLinks = isSuperAdmin ? [] : tenantBottom;

  return (
    <div className="min-h-screen flex w-full">
      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 flex flex-col
          bg-sidebar text-sidebar-foreground
          transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
          ${collapsed ? "w-16" : "w-60"}
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0 lg:static
        `}
      >
        {/* Logo */}
        <div
          className={`flex items-center gap-2 border-b border-sidebar-border h-14 ${collapsed ? "justify-center px-2" : "pl-4 pr-2"}`}
        >
          {!collapsed && <img src={rizonhireLogoBlue} alt="RizonHire" className="w-32 h-auto min-w-0 flex-shrink" />}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`hidden lg:flex items-center justify-center w-8 h-8 rounded-md text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors flex-shrink-0 ${collapsed ? "" : "ml-auto"}`}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <ChevronLeft className={`w-4 h-4 transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`} />
          </button>
          <button
            onClick={() => setMobileOpen(false)}
            className="ml-auto lg:hidden text-sidebar-foreground/60 hover:text-sidebar-foreground flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {isSuperAdmin && !collapsed && (
            <div className="px-3 mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/30">
                Platform
              </span>
            </div>
          )}
          {topLinks.map((item) => {
            const active =
              item.to === "/"
                ? location.pathname === "/"
                : location.pathname === item.to ||
                  (item.to !== "/admin" && location.pathname.startsWith(item.to + "/"));
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={`
                  flex items-center gap-3 rounded-lg text-sm font-medium
                  transition-colors duration-150
                  ${collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5"}
                  ${
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  }
                `}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}

          {bottomLinks.length > 0 && (
            <div className="pt-2 mt-2 border-t border-sidebar-border/50 space-y-0.5">
              {bottomLinks.map((item) => {
                const active =
                  item.to === "/"
                    ? location.pathname === "/"
                    : location.pathname === item.to || location.pathname.startsWith(item.to + "/");
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className={`
                      flex items-center gap-3 rounded-lg text-sm font-medium
                      transition-colors duration-150
                      ${collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5"}
                      ${
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                      }
                    `}
                    title={collapsed ? item.label : undefined}
                  >
                    <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          )}
        </nav>

        {/* User */}
        <div className={`border-t border-sidebar-border ${collapsed ? "px-2 py-3" : "px-4 py-3"}`}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={`w-full flex items-center gap-2 rounded-lg text-left hover:bg-sidebar-accent/50 transition-colors ${
                  collapsed ? "justify-center p-2" : "px-2 py-2"
                }`}
                title={collapsed ? (profile?.name ?? "Account") : undefined}
              >
                <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center text-xs font-semibold flex-shrink-0">
                  {(profile?.name ?? "?").slice(0, 1).toUpperCase()}
                </div>
                {!collapsed && (
                  <>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{profile?.name}</div>
                      <div className="text-xs text-sidebar-foreground/40 truncate capitalize">{role ?? "user"}</div>
                    </div>
                    <ChevronUp className="w-4 h-4 text-sidebar-foreground/40 flex-shrink-0" />
                  </>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="text-sm font-medium truncate">{profile?.name}</div>
                <div className="text-xs text-muted-foreground truncate">{profile?.email}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {!isSuperAdmin && role === "admin" && (
                <DropdownMenuItem asChild>
                  <Link to="/team">
                    <Users className="w-4 h-4 mr-2" /> Team
                  </Link>
                </DropdownMenuItem>
              )}
              {!isSuperAdmin && (
                <DropdownMenuItem asChild>
                  <Link to="/settings/email-templates">
                    <Mail className="w-4 h-4 mr-2" /> Email Templates
                  </Link>
                </DropdownMenuItem>
              )}
              {!isSuperAdmin && (
                <DropdownMenuItem asChild>
                  <Link to="/billing">
                    <Receipt className="w-4 h-4 mr-2" /> Billing
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem asChild>
                <Link to="/legal/data-protection">
                  <FileText className="w-4 h-4 mr-2" /> Data Protection
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
                <LogOut className="w-4 h-4 mr-2" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-foreground/20 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b bg-card flex items-center px-4 lg:hidden sticky top-0 z-20">
          <button onClick={() => setMobileOpen(true)} className="active:scale-95 transition-transform">
            <Menu className="w-5 h-5" />
          </button>
          <img src={rizonhireLogoBlack} alt="RizonHire" className="ml-3 w-24 h-auto" />
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
