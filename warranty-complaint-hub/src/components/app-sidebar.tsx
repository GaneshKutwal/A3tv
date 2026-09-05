import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ShieldPlus,
  ShieldCheck,
  ClipboardPlus,
  ClipboardList,
  History,
  LogOut,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/data";

const nav = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "New Warranty", url: "/warranty/new", icon: ShieldPlus },
  { title: "View Warranty", url: "/warranty", icon: ShieldCheck },
  { title: "Register Complaint", url: "/complaints/new", icon: ClipboardPlus },
  { title: "View Complaints", url: "/complaints", icon: ClipboardList },
  { title: "Complaint History", url: "/complaints/history", icon: History },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user, logout } = useAuth();
  const currentPath = useRouterState({
    select: (router) => router.location.pathname,
  });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-3 px-2 py-3">
          <img
            src="/favicon.png"
            alt="A3 Television logo"
            className="h-9 w-9 shrink-0 rounded-md object-cover glow-primary"
          />
          {!collapsed && (
            <div className="min-w-0">
              <p className="font-display truncate text-sm font-semibold tracking-wide text-sidebar-foreground">
                A3 TELEVISION
              </p>
              <p className="truncate text-xs text-muted-foreground">Service Desk</p>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={currentPath === item.url}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={logout} className="flex items-center gap-2">
              <LogOut className="h-4 w-4" />
              {!collapsed && <span>Sign out{user ? ` (${user})` : ""}</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
