import type { Instrumentation } from "next";

/**
 * Server error telemetry (PRD §9, §16 M5): structured, content-free log lines
 * (route, method, digest, error name) that Vercel's runtime logs collect.
 * Request headers and bodies are deliberately not logged.
 */
export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  const digest =
    typeof error === "object" && error !== null && "digest" in error
      ? String(error.digest)
      : undefined;
  console.error(
    JSON.stringify({
      event: "request_error",
      method: request.method,
      path: request.path.split("?")[0],
      routePath: context.routePath,
      routeType: context.routeType,
      renderSource: context.renderSource,
      digest,
      name: error instanceof Error ? error.name : typeof error,
    }),
  );
};
