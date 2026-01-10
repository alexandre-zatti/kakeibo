"use client";

import { useEffect } from "react";
import { setupGlobalErrorHandlers } from "@/lib/client-logger";

export function GlobalErrorHandlers() {
  useEffect(() => {
    setupGlobalErrorHandlers();
  }, []);

  return null;
}
