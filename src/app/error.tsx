"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { clientLogger } from "@/lib/client-logger";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    clientLogger.error("Application error", error, { digest: error.digest });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/15">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle>Something went wrong</CardTitle>
          <CardDescription>An unexpected error occurred. Please try again.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {process.env.NODE_ENV === "development" && (
            <div className="max-h-32 overflow-auto rounded-md bg-muted p-3 font-mono text-xs">
              {error.message}
            </div>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => (window.location.href = "/")}
            >
              Go Home
            </Button>
            <Button className="flex-1" onClick={reset}>
              Try Again
            </Button>
          </div>
          {error.digest && (
            <p className="text-center text-xs text-muted-foreground">Error ID: {error.digest}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
