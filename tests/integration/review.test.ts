import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  anonClient,
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "./helpers";

/** apply_review(): atomic, idempotent and owner-only (PRD §15 review criteria). */

const admin = adminClient();
let a: TestUser;
let b: TestUser;
let itemId: string;

const card = (reps: number) => ({
  reps,
  state: reps === 0 ? 0 : 2,
  dueAt: "2026-11-03T09:00:00.000Z",
});

function args(overrides: Record<string, unknown> = {}) {
  return {
    p_item_id: itemId,
    p_client_request_id: randomUUID(),
    p_expected_state: null,
    p_previous_state: card(0),
    p_next_state: card(1),
    p_grade: 3,
    p_response_text: "I'm into techno",
    p_ai_suggested_grade: null as unknown as number,
    p_status: "review",
    p_due_at: "2026-11-08T09:00:00Z",
    p_reviewed_at: "2026-11-03T09:00:00Z",
    ...overrides,
  };
}

beforeAll(async () => {
  [a, b] = await Promise.all([createTestUser(admin), createTestUser(admin)]);
  const { data, error } = await a.client
    .from("learning_items")
    .insert({
      user_id: a.id,
      phrase: "I'm into...",
      normalized_phrase: "i'm into",
      status: "new",
      due_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  itemId = data!.id;
});

afterAll(async () => {
  await Promise.all([deleteTestUser(admin, a), deleteTestUser(admin, b)]);
});

describe("apply_review", () => {
  const firstRequest = randomUUID();

  it("writes one log and updates the card atomically", async () => {
    const { data, error } = await a.client.rpc(
      "apply_review",
      args({ p_client_request_id: firstRequest }),
    );
    expect(error).toBeNull();
    expect(data?.[0]).toMatchObject({ status: "review", duplicate: false });

    const { data: item } = await a.client
      .from("learning_items")
      .select("status, fsrs_state, last_reviewed_at")
      .eq("id", itemId)
      .single();
    expect(item?.status).toBe("review");
    expect(item?.fsrs_state).toMatchObject({ reps: 1 });
    expect(item?.last_reviewed_at).not.toBeNull();
  });

  it("is idempotent: retrying the same request id changes nothing", async () => {
    const { data, error } = await a.client.rpc(
      "apply_review",
      args({
        p_client_request_id: firstRequest,
        p_expected_state: card(1),
        p_next_state: card(2),
      }),
    );
    expect(error).toBeNull();
    expect(data?.[0]?.duplicate).toBe(true);
    const { count } = await admin
      .from("review_logs")
      .select("id", { count: "exact", head: true })
      .eq("learning_item_id", itemId);
    expect(count).toBe(1);
  });

  it("rejects a grade computed from a stale card state", async () => {
    const { error } = await a.client.rpc(
      "apply_review",
      args({ p_expected_state: null }),
    );
    expect(error?.code).toBe("EM409");
  });

  it("does not let another learner review the card", async () => {
    const { error } = await b.client.rpc(
      "apply_review",
      args({ p_expected_state: card(1) }),
    );
    expect(error?.code).toBe("P0002");
    const { data: item } = await admin
      .from("learning_items")
      .select("fsrs_state")
      .eq("id", itemId)
      .single();
    expect(item?.fsrs_state).toMatchObject({ reps: 1 });
  });

  it("cannot be called anonymously", async () => {
    const { error } = await anonClient().rpc("apply_review", args());
    expect(error?.code).toBe("42501");
  });

  it("keeps review logs immutable for the learner", async () => {
    const { error } = await a.client
      .from("review_logs")
      .update({ grade: 4 })
      .eq("learning_item_id", itemId);
    expect(error?.code).toBe("42501");
  });
});
