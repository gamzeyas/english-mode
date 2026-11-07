import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  anonClient,
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "./helpers";

/**
 * PRD §8 / §15: multiple accounts must not be able to access each other's
 * sessions, messages, items or logs via the API. Runs against the real
 * project with two throwaway learners (A owns data, B attacks it).
 */

const admin = adminClient();
let a: TestUser;
let b: TestUser;
let sessionA: string;
let messageA: string;
let itemA: string;

beforeAll(async () => {
  [a, b] = await Promise.all([createTestUser(admin), createTestUser(admin)]);

  const session = await a.client
    .from("sessions")
    .insert({ user_id: a.id, mode: "text" })
    .select("id")
    .single();
  expect(session.error).toBeNull();
  sessionA = session.data!.id;

  const message = await a.client
    .from("messages")
    .insert({
      session_id: sessionA,
      user_id: a.id,
      role: "user",
      content: "I'm into melodic techno.",
      sequence_number: 0,
    })
    .select("id")
    .single();
  expect(message.error).toBeNull();
  messageA = message.data!.id;

  const item = await a.client
    .from("learning_items")
    .insert({
      user_id: a.id,
      phrase: "I'm into...",
      normalized_phrase: "i'm into",
      status: "new",
    })
    .select("id")
    .single();
  expect(item.error).toBeNull();
  itemA = item.data!.id;
});

afterAll(async () => {
  await Promise.all([deleteTestUser(admin, a), deleteTestUser(admin, b)]);
});

describe("profiles", () => {
  it("are created automatically and visible only to their owner", async () => {
    const { data, error } = await b.client.from("profiles").select("user_id");
    expect(error).toBeNull();
    expect(data).toEqual([{ user_id: b.id }]);
  });

  it("cannot be updated by another learner", async () => {
    const { data } = await b.client
      .from("profiles")
      .update({ display_name: "hacked" })
      .eq("user_id", a.id)
      .select();
    expect(data).toEqual([]);
    const { data: own } = await admin
      .from("profiles")
      .select("display_name")
      .eq("user_id", a.id)
      .single();
    expect(own?.display_name).toBeNull();
  });

  it("do not allow changing protected columns", async () => {
    const { error } = await a.client
      .from("profiles")
      .update({ user_id: b.id })
      .eq("user_id", a.id);
    expect(error?.code).toBe("42501");
  });
});

describe("cross-user reads", () => {
  it.each(["sessions", "messages", "learning_items"] as const)(
    "%s of A are invisible to B",
    async (table) => {
      const { data, error } = await b.client.from(table).select("id");
      expect(error).toBeNull();
      expect(data).toEqual([]);
    },
  );

  it("A sees its own rows", async () => {
    const { data } = await a.client.from("messages").select("id");
    expect(data).toEqual([{ id: messageA }]);
  });
});

describe("cross-user writes", () => {
  it("B cannot write rows owned by A", async () => {
    const { error } = await b.client
      .from("learning_items")
      .insert({ user_id: a.id, phrase: "x", normalized_phrase: "x" });
    expect(error?.code).toBe("42501");
  });

  it("B cannot attach its own message to A's session", async () => {
    const { error } = await b.client.from("messages").insert({
      session_id: sessionA,
      user_id: b.id,
      role: "user",
      content: "hi",
      sequence_number: 1,
    });
    // Composite FK (session_id, user_id) -> sessions(id, user_id) rejects it.
    expect(error?.code).toBe("23503");
  });

  it("B cannot log a review against A's learning item", async () => {
    const { error } = await b.client.from("review_logs").insert({
      user_id: b.id,
      learning_item_id: itemA,
      grade: 3,
      previous_state: {},
      next_state: {},
    });
    expect(error?.code).toBe("23503");
  });

  it("B cannot delete A's session", async () => {
    const { data } = await b.client
      .from("sessions")
      .delete()
      .eq("id", sessionA)
      .select();
    expect(data).toEqual([]);
    const { count } = await admin
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("id", sessionA);
    expect(count).toBe(1);
  });
});

describe("server-only and immutable tables", () => {
  it("messages cannot be edited after they are written", async () => {
    const { error } = await a.client
      .from("messages")
      .update({ content: "edited" })
      .eq("id", messageA);
    expect(error?.code).toBe("42501");
  });

  it("learners cannot write analyzer feedback or usage logs", async () => {
    const feedback = await a.client.from("session_feedback").insert({
      session_id: sessionA,
      user_id: a.id,
      analyzer_version: "x",
      payload: {},
    });
    expect(feedback.error?.code).toBe("42501");

    const usage = await a.client
      .from("ai_usage_logs")
      .insert({ user_id: a.id, provider: "x", model: "x", operation: "x" });
    expect(usage.error?.code).toBe("42501");
  });

  it("scenarios are readable but not writable", async () => {
    const { data } = await a.client.from("scenarios").select("slug");
    expect(data?.length).toBeGreaterThanOrEqual(4);
    const { error } = await a.client
      .from("scenarios")
      .insert({ slug: "x", title: "x", category: "social" });
    expect(error?.code).toBe("42501");
  });
});

describe("anonymous access", () => {
  it.each(["profiles", "scenarios", "sessions", "learning_items"] as const)(
    "anon cannot read %s",
    async (table) => {
      const { data, error } = await anonClient().from(table).select("*");
      // Either a privilege error or an empty result; never data.
      expect(error ? error.code : data).toEqual(error ? "42501" : []);
    },
  );
});

describe("constraints", () => {
  it("allows only one active consent per type", async () => {
    const first = await a.client.from("consents").insert({
      user_id: a.id,
      consent_type: "data_processing",
      version: "test",
    });
    expect(first.error).toBeNull();
    const second = await a.client.from("consents").insert({
      user_id: a.id,
      consent_type: "data_processing",
      version: "test",
    });
    expect(second.error?.code).toBe("23505");
  });

  it("deduplicates learning items per learner by normalized phrase", async () => {
    const { error } = await a.client.from("learning_items").insert({
      user_id: a.id,
      phrase: "I'm into",
      normalized_phrase: "i'm into",
    });
    expect(error?.code).toBe("23505");
  });

  it("deleting a session cascades to its messages", async () => {
    const { data } = await a.client
      .from("sessions")
      .insert({ user_id: a.id, mode: "text" })
      .select("id")
      .single();
    await a.client.from("messages").insert({
      session_id: data!.id,
      user_id: a.id,
      role: "user",
      content: "temp",
      sequence_number: 0,
    });
    await a.client.from("sessions").delete().eq("id", data!.id);
    const { count } = await admin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("session_id", data!.id);
    expect(count).toBe(0);
  });
});

describe("assignments, submissions, writing, assessments (Milestone 4)", () => {
  let assignmentA: string;

  beforeAll(async () => {
    const { data, error } = await a.client
      .from("assignments")
      .insert({
        user_id: a.id,
        title: "Rewrite",
        instructions: "Rewrite this.",
        kind: "rewrite",
        scheduled_for: "2026-11-03",
        plan_key: "2026-11-03:recap",
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    assignmentA = data!.id;
  });

  it("A's assignments are invisible to B and B cannot create them for A", async () => {
    const { data } = await b.client.from("assignments").select("id");
    expect(data).toEqual([]);
    const { error } = await b.client.from("assignments").insert({
      user_id: a.id,
      title: "x",
      instructions: "x",
      kind: "review",
      scheduled_for: "2026-11-03",
    });
    expect(error?.code).toBe("42501");
  });

  it("B cannot link its assignment to A's session", async () => {
    const { error } = await b.client.from("assignments").insert({
      user_id: b.id,
      title: "x",
      instructions: "x",
      kind: "follow_up",
      scheduled_for: "2026-11-03",
      source_session_id: sessionA,
    });
    expect(error?.code).toBe("23503");
  });

  it("plan keys make generated tasks idempotent", async () => {
    const { error } = await a.client.from("assignments").insert({
      user_id: a.id,
      title: "dup",
      instructions: "dup",
      kind: "rewrite",
      scheduled_for: "2026-11-03",
      plan_key: "2026-11-03:recap",
    });
    expect(error?.code).toBe("23505");
  });

  it("B cannot submit to or skip A's assignment", async () => {
    const submit = await b.client
      .from("submissions")
      .insert({ assignment_id: assignmentA, user_id: b.id, answer_text: "x" });
    expect(submit.error?.code).toBe("23503");
    const { data } = await b.client
      .from("assignments")
      .update({ status: "skipped" })
      .eq("id", assignmentA)
      .select();
    expect(data).toEqual([]);
  });

  it("learners submit once and cannot forge feedback", async () => {
    const forged = await a.client.from("submissions").insert({
      assignment_id: assignmentA,
      user_id: a.id,
      answer_text: "x",
      feedback: { summary_tr: "perfect" },
    });
    expect(forged.error?.code).toBe("42501");

    const first = await a.client
      .from("submissions")
      .insert({ assignment_id: assignmentA, user_id: a.id, answer_text: "x" });
    expect(first.error).toBeNull();
    const second = await a.client
      .from("submissions")
      .insert({ assignment_id: assignmentA, user_id: a.id, answer_text: "y" });
    expect(second.error?.code).toBe("23505");
  });

  it("writing entries and assessments are server-written", async () => {
    const writing = await a.client.from("writing_entries").insert({
      user_id: a.id,
      source_text: "x",
      intent: "x",
      register: "neutral",
      coach_version: "x",
      response: {},
    });
    expect(writing.error?.code).toBe("42501");
    const assessment = await a.client
      .from("assessments")
      .insert({ user_id: a.id, modality: "text" });
    expect(assessment.error?.code).toBe("42501");
  });

  it("writing entries are private and deletable by their owner", async () => {
    const { data: entry } = await admin
      .from("writing_entries")
      .insert({
        user_id: a.id,
        source_text: "Hello",
        intent: "Greet",
        register: "casual",
        coach_version: "test",
        response: {},
      })
      .select("id")
      .single();
    const { data: seenByB } = await b.client
      .from("writing_entries")
      .select("id");
    expect(seenByB).toEqual([]);
    await b.client.from("writing_entries").delete().eq("id", entry!.id);
    const { data: stillThere } = await a.client
      .from("writing_entries")
      .select("id");
    expect(stillThere).toEqual([{ id: entry!.id }]);
    const { error } = await a.client
      .from("writing_entries")
      .update({ response: { forged: true } })
      .eq("id", entry!.id);
    expect(error?.code).toBe("42501");
    await a.client.from("writing_entries").delete().eq("id", entry!.id);
    const { data: gone } = await a.client.from("writing_entries").select("id");
    expect(gone).toEqual([]);
  });

  it("listening exercises are private, server-written and server-graded", async () => {
    const forged = await a.client.from("listening_exercises").insert({
      user_id: a.id,
      kind: "dictation",
      content: {},
      generator_version: "x",
      dialect: "en-US",
    });
    expect(forged.error?.code).toBe("42501");

    const { data: exercise } = await admin
      .from("listening_exercises")
      .insert({
        user_id: a.id,
        kind: "dictation",
        content: { title: "T", sentences: [] },
        generator_version: "test",
        dialect: "en-US",
      })
      .select("id")
      .single();
    const { data: seenByB } = await b.client
      .from("listening_exercises")
      .select("id");
    expect(seenByB).toEqual([]);
    // Learners cannot write their own score.
    const { error } = await a.client
      .from("listening_exercises")
      .update({ score: 1, completed_at: new Date().toISOString() })
      .eq("id", exercise!.id);
    expect(error?.code).toBe("42501");
    await b.client.from("listening_exercises").delete().eq("id", exercise!.id);
    const { data: stillThere } = await a.client
      .from("listening_exercises")
      .select("id");
    expect(stillThere).toEqual([{ id: exercise!.id }]);
    await a.client.from("listening_exercises").delete().eq("id", exercise!.id);
    const { data: gone } = await a.client
      .from("listening_exercises")
      .select("id");
    expect(gone).toEqual([]);
  });
});

describe("account erasure (PRD §14)", () => {
  it("deleting the auth user erases every learner-owned row", async () => {
    const c = await createTestUser(admin);
    const { data: session } = await c.client
      .from("sessions")
      .insert({ user_id: c.id, mode: "text" })
      .select("id")
      .single();
    await c.client.from("messages").insert({
      session_id: session!.id,
      user_id: c.id,
      role: "user",
      content: "bye",
      sequence_number: 0,
    });
    await c.client.from("learning_items").insert({
      user_id: c.id,
      phrase: "See you",
      normalized_phrase: "see you",
    });
    await c.client.from("assignments").insert({
      user_id: c.id,
      title: "x",
      instructions: "x",
      kind: "review",
      scheduled_for: "2026-11-03",
    });
    await admin.from("writing_entries").insert({
      user_id: c.id,
      source_text: "x",
      intent: "x",
      register: "casual",
      coach_version: "test",
      response: {},
    });
    await admin.from("listening_exercises").insert({
      user_id: c.id,
      kind: "comprehension",
      content: {},
      generator_version: "test",
      dialect: "en-GB",
    });

    await deleteTestUser(admin, c);

    for (const table of [
      "profiles",
      "sessions",
      "messages",
      "learning_items",
      "assignments",
      "writing_entries",
      "listening_exercises",
    ] as const) {
      const { count } = await admin
        .from(table)
        .select("user_id", { count: "exact", head: true })
        .eq("user_id", c.id);
      expect(count, table).toBe(0);
    }
  });
});
