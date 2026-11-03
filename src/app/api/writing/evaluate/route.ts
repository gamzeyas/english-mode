import { z } from "zod";
import { readJson, withApi } from "@/lib/api/handler";
import {
  evaluateWriting,
  MAX_WRITING_CHARS,
  REGISTERS,
} from "@/lib/writing/service";

const bodySchema = z.object({
  sourceText: z.string().trim().min(1).max(MAX_WRITING_CHARS),
  intent: z.string().trim().min(1).max(200),
  tone: z.enum(REGISTERS),
});

/** POST /api/writing/evaluate {sourceText, intent, tone} -> {entry} */
export const POST = withApi(async ({ user, profile }, request: Request) => {
  const body = await readJson(request, bodySchema);
  return {
    entry: await evaluateWriting(user, profile, {
      sourceText: body.sourceText,
      intent: body.intent,
      register: body.tone,
    }),
  };
});
