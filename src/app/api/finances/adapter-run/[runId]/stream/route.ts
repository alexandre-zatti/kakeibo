import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import logger from "@/lib/logger";
import { getHouseholdByUserId } from "@/services/household";
import { getAdapterRunById } from "@/services/adapter-run";
import { AdapterRunLogStatus, AdapterRunStatus } from "@/types/finances";

const log = logger.child({ module: "api/adapter-run/stream" });

export async function GET(_request: Request, { params }: { params: Promise<{ runId: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { runId: runIdParam } = await params;
  const runId = parseInt(runIdParam, 10);
  if (isNaN(runId)) {
    return new Response(JSON.stringify({ error: "Invalid run ID" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const household = await getHouseholdByUserId(session.user.id);
  if (!household) {
    return new Response(JSON.stringify({ error: "No household found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const initialRun = await getAdapterRunById(runId, household.id);
  if (!initialRun) {
    return new Response(JSON.stringify({ error: "Adapter run not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const sentStatuses = new Map<number, string>();

      function send(event: string, data: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event, ...data })}\n\n`));
      }

      async function poll() {
        try {
          const run = await getAdapterRunById(runId, household!.id);
          if (!run) {
            send("run:completed", { status: AdapterRunStatus.FAILED });
            controller.close();
            return;
          }

          // On first poll, send init with all logs
          if (sentStatuses.size === 0) {
            send("run:init", {
              runId: run.id,
              status: run.status,
              logs: run.logs.map((l) => ({
                id: l.id,
                adapterName: l.adapter.name,
                status: l.status,
                expenseEntryId: l.expenseEntryId,
                errorMessage: l.errorMessage,
              })),
            });
            for (const l of run.logs) {
              sentStatuses.set(l.id, l.status);
            }
          } else {
            // Send incremental updates for changed statuses
            for (const l of run.logs) {
              const prev = sentStatuses.get(l.id);
              if (prev !== l.status) {
                sentStatuses.set(l.id, l.status);

                if (l.status === AdapterRunLogStatus.RUNNING) {
                  send("adapter:running", {
                    logId: l.id,
                    adapterName: l.adapter.name,
                  });
                } else if (l.status === AdapterRunLogStatus.SUCCESS) {
                  send("adapter:success", {
                    logId: l.id,
                    adapterName: l.adapter.name,
                    expenseEntryId: l.expenseEntryId,
                  });
                } else if (l.status === AdapterRunLogStatus.ERROR) {
                  send("adapter:error", {
                    logId: l.id,
                    adapterName: l.adapter.name,
                    errorMessage: l.errorMessage,
                  });
                }
              }
            }
          }

          // Check if run is complete
          const terminalStatuses: string[] = [
            AdapterRunStatus.COMPLETED,
            AdapterRunStatus.FAILED,
            AdapterRunStatus.PARTIAL,
          ];
          if (terminalStatuses.includes(run.status)) {
            send("run:completed", { status: run.status });
            controller.close();
            return;
          }

          // Schedule next poll
          setTimeout(poll, 2000);
        } catch (error) {
          log.error({ error, runId }, "SSE polling error");
          try {
            send("run:completed", { status: AdapterRunStatus.FAILED });
            controller.close();
          } catch {
            // Stream already closed
          }
        }
      }

      // Initial delay to let the runner start
      setTimeout(poll, 1000);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
