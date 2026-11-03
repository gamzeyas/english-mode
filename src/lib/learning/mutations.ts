import "server-only";
import { z } from "zod";
import type { CurrentUser } from "@/lib/auth/dal";
import { SessionError } from "@/lib/sessions/errors";
import { createClient } from "@/lib/supabase/server";
import { normalizePhrase } from "@/lib/text/normalize";

const text = (max: number) => z.string().trim().max(max);

export const createItemSchema = z.object({
  phrase: text(300).min(1),
  meaningTr: text(300).nullish(),
  example: text(500).nullish(),
});

/** PATCH: content edits, approving a suggestion, archiving or restoring. */
export const updateItemSchema = z
  .object({
    phrase: text(300).min(1).optional(),
    meaningTr: text(300).nullable().optional(),
    example: text(500).nullable().optional(),
    action: z.enum(["approve", "archive", "restore"]).optional(),
  })
  .refine((value) => Object.keys(value).length > 0);

const SELECT =
  "id, phrase, normalized_phrase, meaning_tr, example, category, status, source_context, due_at, last_reviewed_at, created_at, fsrs_state";

/** Manually saved phrases join the queue immediately (due now). */
export async function createItem(
  user: CurrentUser,
  input: z.infer<typeof createItemSchema>,
) {
  const normalized = normalizePhrase(input.phrase);
  if (!normalized) throw new SessionError("invalid_request");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("learning_items")
    .insert({
      user_id: user.id,
      phrase: input.phrase,
      normalized_phrase: normalized,
      meaning_tr: input.meaningTr || null,
      example: input.example || null,
      status: "new",
      due_at: new Date().toISOString(),
      source_context: "Added manually",
    })
    .select(SELECT)
    .single();
  if (error?.code === "23505") throw new SessionError("duplicate");
  if (error || !data)
    throw new Error("Item could not be created.", { cause: error });
  return data;
}

export async function updateItem(
  user: CurrentUser,
  itemId: string,
  input: z.infer<typeof updateItemSchema>,
) {
  const supabase = await createClient();
  const { data: current } = await supabase
    .from("learning_items")
    .select("status, fsrs_state")
    .eq("id", itemId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!current) throw new SessionError("not_found");

  const patch: {
    phrase?: string;
    normalized_phrase?: string;
    meaning_tr?: string | null;
    example?: string | null;
    status?: string;
    due_at?: string;
  } = {};
  if (input.phrase !== undefined) {
    const normalized = normalizePhrase(input.phrase);
    if (!normalized) throw new SessionError("invalid_request");
    patch.phrase = input.phrase;
    patch.normalized_phrase = normalized;
  }
  if (input.meaningTr !== undefined) patch.meaning_tr = input.meaningTr || null;
  if (input.example !== undefined) patch.example = input.example || null;

  if (input.action === "approve") {
    if (current.status !== "suggested")
      throw new SessionError("invalid_request");
    patch.status = "new";
    patch.due_at = new Date().toISOString();
  }
  if (input.action === "archive") patch.status = "archived";
  if (input.action === "restore") {
    if (current.status !== "archived")
      throw new SessionError("invalid_request");
    // Back into rotation; FSRS state (if any) is kept, so history is not lost.
    patch.status = current.fsrs_state ? "review" : "new";
    patch.due_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("learning_items")
    .update(patch)
    .eq("id", itemId)
    .eq("user_id", user.id)
    .select(SELECT)
    .single();
  if (error?.code === "23505") throw new SessionError("duplicate");
  if (error || !data)
    throw new Error("Item could not be updated.", { cause: error });
  return data;
}

/** Deletes the item and (by cascade) its review history. */
export async function deleteItem(user: CurrentUser, itemId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("learning_items")
    .delete()
    .eq("id", itemId)
    .eq("user_id", user.id)
    .select("id");
  if (error) throw new Error("Item could not be deleted.", { cause: error });
  if (!data.length) throw new SessionError("not_found");
}
