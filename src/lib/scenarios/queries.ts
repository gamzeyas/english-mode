import "server-only";
import { toScenario } from "@/lib/scenarios/map";
import { createClient } from "@/lib/supabase/server";
import type { Scenario } from "@/types/domain";

const CATEGORY_ORDER = ["career", "founder", "client", "social"];

/** Active scenario catalog (RLS: readable by signed-in learners). */
export async function listScenarios(): Promise<Scenario[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scenarios")
    .select("*")
    .eq("is_active", true);
  if (error)
    throw new Error("Scenarios could not be loaded.", { cause: error });
  return data
    .map(toScenario)
    .sort(
      (a, b) =>
        CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category),
    );
}

export async function getScenario(slug: string): Promise<Scenario | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("scenarios")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  return data ? toScenario(data) : null;
}
