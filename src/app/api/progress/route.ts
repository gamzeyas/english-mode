import { withApi } from "@/lib/api/handler";
import { getProgressStats } from "@/lib/learning/progress";

/** GET /api/progress -> informal metrics with evidence counts (not CEFR) */
export const GET = withApi(async ({ profile }) => ({
  ...(await getProgressStats(profile.timezone)),
  disclaimer:
    "Informal coaching metrics from your own activity; not an official assessment.",
}));
