import {
  Banknote,
  Building2,
  FileText,
  HardHat,
  HelpCircle,
  Inbox,
  LayoutDashboard,
  Link2,
  Settings,
  TrendingUp,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";

// Icons that config/navigation.ts can name. Add one here to use it in the menu.
const ICONS: Record<string, LucideIcon> = {
  Banknote,
  Building2,
  FileText,
  HardHat,
  Inbox,
  LayoutDashboard,
  Link2,
  Settings,
  TrendingUp,
  Truck,
  Users,
};

export function NavIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? HelpCircle;
  return <Icon className={className} aria-hidden />;
}
