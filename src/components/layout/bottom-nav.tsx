"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { isNavItemActive, primaryNav, secondaryNav } from "@/lib/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const itemClass =
  "flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[0.7rem] font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/60";

export function BottomNav() {
  const pathname = usePathname();
  const overflowActive = secondaryNav.some((item) =>
    isNavItemActive(item, pathname),
  );

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-stretch gap-0.5 px-1.5 py-1">
        {primaryNav.map((item) => {
          const active = isNavItemActive(item, pathname);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  itemClass,
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon
                  aria-hidden
                  className={cn("size-5", active && "stroke-[2.4]")}
                />
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
        <li className="flex flex-1">
          <Sheet>
            <SheetTrigger
              className={cn(
                itemClass,
                overflowActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <MoreHorizontal aria-hidden className="size-5" />
              <span>More</span>
            </SheetTrigger>
            <SheetContent
              side="bottom"
              className="rounded-t-2xl pb-[env(safe-area-inset-bottom)]"
            >
              <SheetHeader>
                <SheetTitle>More</SheetTitle>
              </SheetHeader>
              <ul className="grid gap-1 px-4 pb-6">
                {secondaryNav.map((item) => {
                  const Icon = item.icon;
                  const active = isNavItemActive(item, pathname);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/60",
                          active
                            ? "bg-secondary text-primary"
                            : "hover:bg-secondary",
                        )}
                      >
                        <Icon aria-hidden className="size-5" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </SheetContent>
          </Sheet>
        </li>
      </ul>
    </nav>
  );
}
