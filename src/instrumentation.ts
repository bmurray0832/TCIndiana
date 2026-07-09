import type { Instrumentation } from "next";

/** Server-side error reporting. Every uncaught error in a request —
 *  server components, server actions, route handlers, middleware —
 *  lands here. We emit one structured JSON line so Railway's log view
 *  (or any log-based alerting) can filter on `"level":"error"`.
 *
 *  To add Sentry later: call Sentry.captureRequestError here instead.
 */
export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context,
) => {
  const error = err instanceof Error ? err : new Error(String(err));
  console.error(
    JSON.stringify({
      level: "error",
      source: "onRequestError",
      message: error.message,
      digest: (error as { digest?: string }).digest,
      stack: error.stack?.split("\n").slice(0, 6).join("\n"),
      path: request.path,
      method: request.method,
      routerKind: context.routerKind,
      routeType: context.routeType,
      at: new Date().toISOString(),
    }),
  );
};
