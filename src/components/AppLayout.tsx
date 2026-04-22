import { Link, useLocation, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Briefcase,
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
} from "lucide-react";
import { useState } from "react";
import rizonhireLogo from "@/assets/RH logo white.png";

const TEST_ADMIN_EMAIL = "testadmin@email.com";

const atsNavItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/jobs", label: "Jobs", icon: Briefcase },
  { to: "/candidates", label: "Candidates", icon: Users },
  { to: "/pipeline", label: "Pipeline", icon: FolderKanban },
  { to: "/admin/candidate-tags", label: "Candidate Tags", icon: Tags },
];

const screeningNavItems = [{ to: "/screening", label: "Video Screening", icon: Video }];

const assessmentNavItem = { to: "/assessment", label: "Assessment", icon: ClipboardCheck };

const superAdminNav = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard },
  { to: "/admin/companies", label: "Companies", icon: Building2 },
];

export default function AppLayout() {
  const { profile, role, signOut } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const isTestAdmin = profile?.email === TEST_ADMIN_EMAIL;
  const isSuperAdmin = role === "super_admin";
  const topLinks = isSuperAdmin
    ? superAdminNav
    : isTestAdmin
      ? [...atsNavItems, ...screeningNavItems]
      : screeningNavItems;
  const bottomLinks = isSuperAdmin ? [] : [assessmentNavItem];

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
          className={`flex items-center gap-2.5 border-b border-sidebar-border h-14 ${collapsed ? "justify-center px-2" : "px-5"}`}
        >
          {collapsed ? (
            <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center flex-shrink-0">
              <Briefcase className="w-4 h-4 text-sidebar-primary-foreground" />
            </div>
          ) : (
            <img src={rizonhireLogo} alt="RizonHire" className="h-12 w-auto" />
          )}
          <button
            onClick={() => setMobileOpen(false)}
            className="ml-auto lg:hidden text-sidebar-foreground/60 hover:text-sidebar-foreground"
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
              location.pathname === item.to || (item.to !== "/admin" && location.pathname.startsWith(item.to));
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
                const active = location.pathname === item.to || location.pathname.startsWith(item.to);
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

        {/* Collapse toggle (desktop) */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex items-center justify-center h-10 mx-2 mb-1 rounded-lg text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
        >
          <ChevronLeft className={`w-4 h-4 transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`} />
        </button>

        {/* User */}
        <div className={`border-t border-sidebar-border ${collapsed ? "px-2 py-3" : "px-4 py-3"}`}>
          {!collapsed ? (
            <>
              <div className="text-sm font-medium truncate">{profile?.name}</div>
              <div className="text-xs text-sidebar-foreground/40 truncate capitalize">{role ?? "user"}</div>
              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
                className="mt-2 w-full justify-start text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 px-0"
              >
                <LogOut className="w-4 h-4 mr-2" /> Sign out
              </Button>
            </>
          ) : (
            <button
              onClick={signOut}
              className="flex items-center justify-center w-full rounded-lg py-2 text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
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
          <img src={rizonhireLogo} alt="RizonHire" className="ml-3 h-6 w-auto" />
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
