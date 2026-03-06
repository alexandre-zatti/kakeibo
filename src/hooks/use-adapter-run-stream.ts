"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export interface AdapterStreamEvent {
  type: "run:init" | "adapter:running" | "adapter:success" | "adapter:error" | "run:completed";
  adapterName?: string;
  error?: string;
  status?: string;
}

export function useAdapterRunStream(runId: number | null) {
  const router = useRouter();
  const eventSourceRef = useRef<EventSource | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [events, setEvents] = useState<AdapterStreamEvent[]>([]);

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (runId === null) {
      cleanup();
      setIsRunning(false);
      setEvents([]);
      return;
    }

    cleanup();
    setIsRunning(true);
    setEvents([]);

    const es = new EventSource(`/api/finances/adapter-run/${runId}/stream`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as AdapterStreamEvent;
        setEvents((prev) => [...prev, data]);

        switch (data.type) {
          case "adapter:success":
            toast.success(`${data.adapterName} concluído`);
            router.refresh();
            break;
          case "adapter:error":
            toast.error(`${data.adapterName}: ${data.error}`);
            router.refresh();
            break;
          case "run:completed":
            setIsRunning(false);
            cleanup();
            break;
        }
      } catch {
        // Ignore malformed events
      }
    };

    es.onerror = () => {
      setIsRunning(false);
      cleanup();
    };

    return cleanup;
  }, [runId, cleanup, router]);

  return { isRunning, events };
}
