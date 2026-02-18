"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowDownCircle, ArrowUpCircle, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/utils";
import type { SavingsBoxWithHistory } from "@/types/finances";
import { SavingsBoxFormSheet } from "./savings-box-form-sheet";
import { SavingsBoxDeleteDialog } from "./savings-box-delete-dialog";
import { SavingsTransactionSheet } from "./savings-transaction-sheet";

interface SavingsBoxDetailProps {
  box: SavingsBoxWithHistory;
}

export function SavingsBoxDetail({ box }: SavingsBoxDetailProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [transactionType, setTransactionType] = useState<"contribution" | "withdrawal" | null>(
    null
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/finances/caixinhas">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">{box.name}</h1>
      </div>

      <Card>
        <CardContent className="space-y-4 py-4">
          <div>
            <p className="text-sm text-muted-foreground">Saldo</p>
            <p className="text-3xl font-bold">{formatCurrency(box.balance)}</p>
          </div>

          {box.monthlyTarget && (
            <p className="text-sm text-muted-foreground">
              Meta mensal: {formatCurrency(box.monthlyTarget)}
            </p>
          )}

          {box.goalProgress !== null && box.goalAmount && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Meta: {formatCurrency(box.goalAmount)}</span>
                <span>{box.goalProgress.toFixed(0)}%</span>
              </div>
              <Progress value={box.goalProgress} className="h-3" />
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <Button size="sm" onClick={() => setTransactionType("contribution")}>
              <ArrowDownCircle className="mr-1 h-4 w-4" />
              Contribuir
            </Button>
            <Button size="sm" variant="outline" onClick={() => setTransactionType("withdrawal")}>
              <ArrowUpCircle className="mr-1 h-4 w-4" />
              Retirar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-1 h-4 w-4" />
              Editar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="mr-1 h-4 w-4" />
              Excluir
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historico</CardTitle>
        </CardHeader>
        <CardContent>
          {box.transactions.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nenhuma transacao registrada.
            </p>
          ) : (
            <div className="space-y-2">
              {box.transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={tx.type === "contribution" ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {tx.type === "contribution" ? "Aporte" : "Retirada"}
                      </Badge>
                      {tx.source !== "manual" && (
                        <Badge variant="outline" className="text-xs">
                          {tx.source === "closing" ? "Fechamento" : "Despesa"}
                        </Badge>
                      )}
                    </div>
                    {tx.description && (
                      <p className="text-xs text-muted-foreground">{tx.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {new Date(tx.createdAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <span
                    className={`text-sm font-medium ${
                      tx.type === "contribution" ? "text-green-500" : "text-red-500"
                    }`}
                  >
                    {tx.type === "contribution" ? "+" : "-"}
                    {formatCurrency(tx.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <SavingsBoxFormSheet box={box} open={editOpen} onOpenChange={setEditOpen} />

      <SavingsBoxDeleteDialog box={box} open={deleteOpen} onOpenChange={setDeleteOpen} />

      {transactionType && (
        <SavingsTransactionSheet
          boxId={box.id}
          boxBalance={box.balance}
          type={transactionType}
          open={!!transactionType}
          onOpenChange={(open) => {
            if (!open) setTransactionType(null);
          }}
        />
      )}
    </div>
  );
}
