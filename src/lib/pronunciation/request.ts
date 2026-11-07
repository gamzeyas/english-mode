import { z } from "zod";
import { MAX_REFERENCE_CHARS } from "@/lib/speech/pronunciation";

/** Where the reference sentence comes from (resolved on the server). */
export const referenceSchema = z.discriminatedUnion("source", [
  z.object({ source: z.literal("catalog"), ref: z.string().min(1).max(60) }),
  z.object({ source: z.literal("pool"), ref: z.uuid() }),
  z.object({
    source: z.literal("custom"),
    text: z.string().trim().min(1).max(MAX_REFERENCE_CHARS),
  }),
]);
