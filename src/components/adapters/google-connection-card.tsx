"use client";

import { useEffect } from "react";
import { Link2, Link2Off, Loader2 } from "lucide-react";
import { useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { disconnectGoogleAction } from "@/actions/adapter";
import { toast } from "sonner";

interface GoogleConnectionCardProps {
  email: string | null;
}

export function GoogleConnectionCard({ email }: GoogleConnectionCardProps) {
  const [isPending, startTransition] = useTransition();
  const searchParams = useSearchParams();

  useEffect(() => {
    const status = searchParams.get("google");
    if (status === "connected") {
      toast.success("Google conectado com sucesso");
    } else if (status === "error") {
      toast.error("Erro ao conectar Google");
    } else if (status === "denied") {
      toast.info("Autorização do Google foi cancelada");
    }
  }, [searchParams]);

  function handleDisconnect() {
    startTransition(async () => {
      const result = await disconnectGoogleAction();
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Google desconectado");
    });
  }

  const isConnected = !!email;

  return (
    <Card>
      <CardContent className="flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          {isConnected ? (
            <Link2 className="h-5 w-5 shrink-0 text-green-600" />
          ) : (
            <Link2Off className="h-5 w-5 shrink-0 text-muted-foreground" />
          )}
          <div>
            <p className="text-sm font-medium">
              {isConnected ? "Google conectado" : "Google não conectado"}
            </p>
            {isConnected ? (
              <p className="text-xs text-muted-foreground">{email}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Conecte para usar adaptadores Gmail/Drive
              </p>
            )}
          </div>
        </div>

        {isConnected ? (
          <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={isPending}>
            {isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            Desconectar
          </Button>
        ) : (
          <Button variant="default" size="sm" asChild>
            <a href="/api/google/authorize">Conectar Google</a>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
