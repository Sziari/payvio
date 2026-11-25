export type NavItem = { label: string; href: string; icon: string; show: boolean };

// Reorder lines to reorder the menu. Set show: false to hide a page.
export const navigation: NavItem[] = [
  { label: "Dashboard",     href: "/dashboard", icon: "LayoutDashboard", show: true },
  { label: "AP Inbox",      href: "/inbox",     icon: "Inbox",           show: true },
  { label: "Jobs",          href: "/jobs",      icon: "HardHat",         show: true },
  { label: "Cash Forecast", href: "/forecast",  icon: "TrendingUp",      show: true },
  { label: "Vendors",       href: "/vendors",   icon: "Truck",           show: true },
  { label: "Pay Apps",      href: "/payapps",   icon: "FileText",        show: false },
  { label: "Settings",      href: "/settings",  icon: "Settings",        show: true },
];
