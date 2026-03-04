"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toggleAdapterActiveAction, deleteAdapterAction } from "@/actions/adapter";
import { retryAdapterLogAction } from "@/actions/adapter-run";
import type {
  AdapterWithLastRun,
  AdapterRunWithLogs,
  SerializedAdapter,
  SerializedAdapterRunLog,
  SerializedCategory,
} from "@/types/finances";
import { AdapterFormSheet } from "./adapter-form-sheet";
import { toast } from "sonner";

interface AdapterListProps {
  adapters: AdapterWithLastRun[];
  runs: AdapterRunWithLogs[];
  availableModules: { key: string; label: string; description: string }[];
  categories: SerializedCategory[];
}

function getModuleLabel(
  moduleKey: string,
  availableModules: { key: string; label: string }[]
): string {
  return availableModules.find((m) => m.key === moduleKey)?.label ?? moduleKey;
}

function RunStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "running":
      return <Badge variant="default">Executando</Badge>;
    case "completed":
      return <Badge className="bg-green-600 hover:bg-green-600/80">Concluído</Badge>;
    case "failed":
      return <Badge variant="destructive">Falhou</Badge>;
    case "partial":
      return <Badge className="bg-yellow-600 hover:bg-yellow-600/80">Parcial</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function LogStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "pending":
      return <Badge variant="outline">Pendente</Badge>;
    case "running":
      return <Badge variant="default">Executando</Badge>;
    case "success":
      return <Badge className="bg-green-600 hover:bg-green-600/80">Sucesso</Badge>;
    case "error":
      return <Badge variant="destructive">Erro</Badge>;
    case "skipped":
      return <Badge variant="secondary">Ignorado</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AdapterList({ adapters, runs, availableModules, categories }: AdapterListProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editAdapter, setEditAdapter] = useState<SerializedAdapter | null>(null);
  const [expandedRuns, setExpandedRuns] = useState<Set<number>>(new Set());
  const [retryingLogs, setRetryingLogs] = useState<Set<number>>(new Set());

  async function handleToggleActive(id: number, isActive: boolean) {
    const result = await toggleAdapterActiveAction(id, isActive);
    if (!result.success) {
      toast.error(result.error);
    }
  }

  async function handleDelete(id: number, name: string) {
    const confirmed = window.confirm(`Tem certeza que deseja excluir o adaptador "${name}"?`);
    if (!confirmed) return;

    const result = await deleteAdapterAction(id);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Adaptador excluído");
  }

  async function handleRetryLog(logId: number) {
    setRetryingLogs((prev) => new Set(prev).add(logId));
    const result = await retryAdapterLogAction(logId);
    setRetryingLogs((prev) => {
      const next = new Set(prev);
      next.delete(logId);
      return next;
    });

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Reexecução iniciada");
  }

  function toggleRunExpanded(runId: number) {
    setExpandedRuns((prev) => {
      const next = new Set(prev);
      if (next.has(runId)) {
        next.delete(runId);
      } else {
        next.add(runId);
      }
      return next;
    });
  }

  return (
    <div className="space-y-8">
      {/* Adapters Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Configurações</h2>
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Novo Adaptador
          </Button>
        </div>

        {adapters.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">
            Nenhum adaptador configurado. Crie um para começar a importar dados automaticamente.
          </p>
        ) : (
          <div className="space-y-2">
            {adapters.map((adapter) => (
              <AdapterCard
                key={adapter.id}
                adapter={adapter}
                moduleLabel={getModuleLabel(adapter.moduleKey, availableModules)}
                onToggleActive={(isActive) => handleToggleActive(adapter.id, isActive)}
                onEdit={() => setEditAdapter(adapter)}
                onDelete={() => handleDelete(adapter.id, adapter.name)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Run History Section */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Histórico de Execuções</h2>

        {runs.length === 0 ? (
          <p className="py-4 text-center text-muted-foreground">
            Nenhuma execução registrada ainda.
          </p>
        ) : (
          <div className="space-y-2">
            {runs.map((run) => (
              <RunCard
                key={run.id}
                run={run}
                isExpanded={expandedRuns.has(run.id)}
                onToggleExpand={() => toggleRunExpanded(run.id)}
                onRetryLog={handleRetryLog}
                retryingLogs={retryingLogs}
              />
            ))}
          </div>
        )}
      </section>

      {/* Form Sheet */}
      <AdapterFormSheet
        open={formOpen || !!editAdapter}
        onOpenChange={(open) => {
          if (!open) {
            setFormOpen(false);
            setEditAdapter(null);
          }
        }}
        availableModules={availableModules}
        adapter={editAdapter}
        categories={categories}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Adapter Card
// ---------------------------------------------------------------------------

interface AdapterCardProps {
  adapter: AdapterWithLastRun;
  moduleLabel: string;
  onToggleActive: (isActive: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}

function AdapterCard({ adapter, moduleLabel, onToggleActive, onEdit, onDelete }: AdapterCardProps) {
  return (
    <Card className={adapter.isActive ? "" : "opacity-60"}>
      <CardContent className="flex items-center justify-between py-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium">{adapter.name}</p>
            <Badge variant="outline" className="shrink-0 text-xs">
              {moduleLabel}
            </Badge>
          </div>
          {adapter.description && (
            <p className="truncate text-xs text-muted-foreground">{adapter.description}</p>
          )}
          {adapter.lastRunLog && (
            <div className="flex items-center gap-2">
              <LogStatusBadge status={adapter.lastRunLog.status} />
              <span className="text-xs text-muted-foreground">
                {formatDate(adapter.lastRunLog.createdAt)}
              </span>
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Switch checked={adapter.isActive} onCheckedChange={onToggleActive} />
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
            <Pencil className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDelete}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Run Card
// ---------------------------------------------------------------------------

interface RunCardProps {
  run: AdapterRunWithLogs;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onRetryLog: (logId: number) => void;
  retryingLogs: Set<number>;
}

function RunCard({ run, isExpanded, onToggleExpand, onRetryLog, retryingLogs }: RunCardProps) {
  return (
    <Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-sm font-medium">{formatDate(run.createdAt)}</span>
                <RunStatusBadge status={run.status} />
              </div>
              <span className="text-xs text-muted-foreground">
                {run.logs.length} {run.logs.length === 1 ? "adaptador" : "adaptadores"}
              </span>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-2 px-4 pb-3 pt-0">
            {run.logs.map((logEntry) => (
              <RunLogEntry
                key={logEntry.id}
                log={logEntry}
                onRetry={() => onRetryLog(logEntry.id)}
                isRetrying={retryingLogs.has(logEntry.id)}
              />
            ))}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// ---------------------------------------------------------------------------
// Run Log Entry
// ---------------------------------------------------------------------------

interface RunLogEntryProps {
  log: SerializedAdapterRunLog;
  onRetry: () => void;
  isRetrying: boolean;
}

function RunLogEntry({ log, onRetry, isRetrying }: RunLogEntryProps) {
  return (
    <div className="flex items-center justify-between rounded-md border px-3 py-2">
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm">{log.adapter.name}</span>
          <LogStatusBadge status={log.status} />
        </div>
        {log.errorMessage && (
          <p className="truncate text-xs text-destructive">{log.errorMessage}</p>
        )}
      </div>
      {log.status === "error" && (
        <Button
          variant="ghost"
          size="icon"
          className="ml-2 h-7 w-7 shrink-0"
          onClick={onRetry}
          disabled={isRetrying}
          title="Reexecutar"
        >
          <RefreshCw className={`h-3 w-3 ${isRetrying ? "animate-spin" : ""}`} />
        </Button>
      )}
    </div>
  );
}
