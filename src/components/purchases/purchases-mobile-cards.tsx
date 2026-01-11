"use client";

import type { Row } from "@tanstack/react-table";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PurchaseRowActions } from "./purchases-row-actions";
import { PurchaseStatus, PurchaseStatusConfig } from "@/types/purchase";
import type { PurchaseWithCount } from "@/types/purchase";
import { formatCurrency } from "@/lib/utils";

interface PurchasesMobileCardsProps {
  rows: Row<PurchaseWithCount>[];
}

export function PurchasesMobileCards({ rows }: PurchasesMobileCardsProps) {
  if (rows.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center rounded-md border border-dashed">
        <p className="text-sm text-muted-foreground">No purchases found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const purchase = row.original;
        const status = purchase.status;
        const config = status
          ? PurchaseStatusConfig[status as keyof typeof PurchaseStatusConfig] ||
            PurchaseStatusConfig[PurchaseStatus.NEEDS_REVIEW]
          : null;
        const date = purchase.boughtAt ? new Date(purchase.boughtAt) : null;
        const totalValue = purchase.totalValue ? Number(purchase.totalValue) : null;
        const itemCount = purchase._count?.products ?? 0;

        return (
          <Card key={purchase.id}>
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <CardTitle className="text-base font-medium">
                {date ? format(date, "MMM d, yyyy") : "Unknown Date"}
              </CardTitle>
              <PurchaseRowActions purchase={purchase} />
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total</span>
                <span className="font-medium">
                  {totalValue !== null ? formatCurrency(totalValue) : "-"}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Items</span>
                <span>{itemCount}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                {config ? <Badge variant={config.variant}>{config.label}</Badge> : <span>-</span>}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
