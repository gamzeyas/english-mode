import { withApi } from "@/lib/api/handler";
import { listScenarios } from "@/lib/scenarios/queries";

/** GET /api/scenarios -> active scenario catalog */
export const GET = withApi(async () => ({ scenarios: await listScenarios() }));
