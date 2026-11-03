"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  isNavItemActive,
  primaryNav,
  secondaryNav,
  type NavItem,
} from "@/lib/navigation";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { BrandMark } from "@/components/layout/brand-mark";

const STORAGE_KEY = "english-mode:rail-collapsed";

export function SideRail() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      // Restoring a per-device UI preference after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      // Storage can be unavailable (private mode); default to expanded.
    }
  }, []);

  function toggle() {
    setCollapsed((value) => {
      const next = !value;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // Ignore storage failures; the toggle still works for this visit.
      }
      return next;
    });
  }

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:flex",
        collapsed ? "w-[4.5rem]" : "w-60",
      )}
    >
      <div
        className={cn(
          "flex h-16 items-center gap-2 px-4",
          collapsed && "justify-center px-0",
        )}
      >
        <BrandMark showName={!collapsed} />
      </div>

      <nav
        aria-label="Primary"
        className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-2"
      >
        <RailGroup
          items={primaryNav}
          pathname={pathname}
          collapsed={collapsed}
        />
        <div>
          {!collapsed && (
            <p className="px-3 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              More
            </p>
          )}
          <RailGroup
            items={secondaryNav}
            pathname={pathname}
            collapsed={collapsed}
          />
        </div>
      </nav>

      <div className="border-t p-3">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          className={cn(
            "flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground outline-none hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/60",
            collapsed && "justify-center px-0",
          )}
        >
          {collapsed ? (
            <PanelLeftOpen aria-hidden className="size-5" />
          ) : (
            <>
              <PanelLeftClose aria-hidden className="size-5" />
              Collapse
            </>
          )}
        </button>
      </div>
    </aside>
  );
}

function RailGroup({
  items,
  pathname,
  collapsed,
}: {
  items: NavItem[];
  pathname: string | null;
  collapsed: boolean;
}) {
  return (
    <ul className="grid gap-1">
      {items.map((item) => {
        const active = isNavItemActive(item, pathname);
        const Icon = item.icon;
        const link = (
          <Link
            href={item.href}
            aria-current={active ? "page" : undefined}
            aria-label={collapsed ? item.label : undefined}
            className={cn(
              "flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/60",
              collapsed && "justify-center px-0",
              active
                ? "bg-sidebar-accent text-sidebar-primary"
                : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
            )}
          >
            <Icon aria-hidden className="size-5 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </Link>
        );
        return (
          <li key={item.href}>
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            ) : (
              link
            )}
          </li>
        );
      })}
    </ul>
  );
}
