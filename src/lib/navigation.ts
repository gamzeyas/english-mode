import {
  BarChart3,
  BookOpenText,
  Drama,
  Layers,
  MessageCircle,
  PenLine,
  Settings,
  Sun,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Additional path prefixes that should highlight this item. */
  matches?: string[];
};

/** PRD §4 Nav: mobile bottom bar shows these five. */
export const primaryNav: NavItem[] = [
  { href: "/dashboard", label: "Today", icon: Sun },
  {
    href: "/conversation/new",
    label: "Speak",
    icon: MessageCircle,
    matches: ["/conversation"],
  },
  { href: "/learning-pool", label: "Pool", icon: Layers, matches: ["/review"] },
  { href: "/scenarios", label: "Simulate", icon: Drama },
  { href: "/progress", label: "Progress", icon: BarChart3 },
];

/** Overflow on mobile, listed below the primary items on desktop. */
export const secondaryNav: NavItem[] = [
  { href: "/writing", label: "Writing", icon: PenLine },
  { href: "/assignments", label: "Assignments", icon: BookOpenText },
  { href: "/settings", label: "Settings", icon: Settings },
];

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isNavItemActive(
  item: NavItem,
  pathname: string | null,
): boolean {
  if (!pathname) return false;
  return [item.href, ...(item.matches ?? [])].some((prefix) =>
    matchesPrefix(pathname, prefix),
  );
}
