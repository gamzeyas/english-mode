import { withApi } from "@/lib/api/handler";
import { getAssignmentsOverview } from "@/lib/assignments/service";

/** GET /api/assignments -> today's plan (created on first read), overdue, upcoming, history */
export const GET = withApi(async ({ user, profile }) =>
  getAssignmentsOverview(user, profile),
);
