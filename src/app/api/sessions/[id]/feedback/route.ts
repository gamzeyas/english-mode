import { uuidParam, withApi } from "@/lib/api/handler";
import { ensureFeedback, getFeedbackState } from "@/lib/sessions/service";

/** GET /api/sessions/:id/feedback -> {state, payload?} (read-only, for polling) */
export const GET = withApi(
  async (
    _context,
    _request: Request,
    { params }: RouteContext<"/api/sessions/[id]/feedback">,
  ) => {
    const { id } = await params;
    return getFeedbackState(uuidParam.parse(id));
  },
);

/**
 * POST /api/sessions/:id/feedback[?retry=1] -> runs the analysis if needed and
 * returns the state. Idempotent and resumable (see ensureFeedback).
 */
export const POST = withApi(
  async (
    { user, profile },
    request: Request,
    { params }: RouteContext<"/api/sessions/[id]/feedback">,
  ) => {
    const { id } = await params;
    const retryFailed = new URL(request.url).searchParams.get("retry") === "1";
    return ensureFeedback(user, profile, uuidParam.parse(id), { retryFailed });
  },
);

// Analysis of a long session can take a while.
export const maxDuration = 120;
