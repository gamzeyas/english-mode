"use client";

import { useState } from "react";
import Link from "next/link";
import { PhraseCard } from "@/components/learning/phrase-card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  filterPool,
  isDue,
  poolFilters,
  type PoolFilter,
} from "@/lib/learning/pool";
import type { LearningItem } from "@/types/domain";

export function LearningPool({
  items,
  now,
}: {
  items: LearningItem[];
  now: string;
}) {
  const [filter, setFilter] = useState<PoolFilter>("all");
  const reference = new Date(now);
  const visible = filterPool(items, filter, reference);

  return (
    <div className="space-y-5">
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Scrolls horizontally on narrow screens instead of wrapping. */}
        <Tabs
          value={filter}
          onValueChange={(value) => setFilter(value as PoolFilter)}
          className="-mx-4 min-w-0 overflow-x-auto px-4 sm:mx-0 sm:px-0"
        >
          <TabsList aria-label="Filter phrases" className="h-11! w-max">
            {poolFilters.map((option) => (
              <TabsTrigger
                key={option.value}
                value={option.value}
                className="px-3"
              >
                {option.label}
                <span className="ml-1 text-xs text-muted-foreground tabular-nums">
                  {filterPool(items, option.value, reference).length}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          {items.length === 0 ? (
            <>
              Henüz kayıtlı ifade yok. Bir konuşma yap; oturum sonunda önerilen
              ifadeleri buraya kaydedebilirsin.{" "}
              <Link
                href="/conversation/new"
                className="text-primary underline-offset-4 hover:underline"
              >
                Start a conversation
              </Link>
            </>
          ) : (
            "No phrases in this filter."
          )}
        </p>
      ) : (
        <ul
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
          aria-live="polite"
        >
          {visible.map((item) => (
            <li key={item.id}>
              <PhraseCard item={item} due={isDue(item, reference)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
