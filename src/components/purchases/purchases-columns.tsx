"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PurchaseRowActions } from "./purchases-row-actions";
import { PurchaseStatus, PurchaseStatusConfig } from "@/types/purchase";
import type { PurchaseWithCount } from "@/types/purchase";
import { formatCurrency } from "@/lib/utils";

export const purchasesColumns: ColumnDef<PurchaseWithCount>[] = [
  {
    accessorKey: "boughtAt",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-4"
        >
          Date
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const date = row.getValue("boughtAt") as Date | string | null;
      if (!date) return <span className="text-muted-foreground">-</span>;
      const dateObj = typeof date === "string" ? new Date(date) : date;
      return <div>{format(dateObj, "MMM d, yyyy")}</div>;
    },
  },
  {
    accessorKey: "totalValue",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-4"
        >
          Total
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const value = row.getValue("totalValue") as number | null;
      if (value === null) return <span className="text-muted-foreground">-</span>;
      return <div className="font-medium">{formatCurrency(value)}</div>;
    },
  },
  {
    accessorKey: "status",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-4"
        >
          Status
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const status = row.getValue("status") as number | null;
      if (!status) return <span className="text-muted-foreground">-</span>;
      const config =
        PurchaseStatusConfig[status as keyof typeof PurchaseStatusConfig] ||
        PurchaseStatusConfig[PurchaseStatus.NEEDS_REVIEW];
      return <Badge variant={config.variant}>{config.label}</Badge>;
    },
    filterFn: (row, id, value) => {
      return value === undefined || value === null || row.getValue(id) === value;
    },
  },
  {
    accessorKey: "_count.products",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-4"
        >
          Items
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const count = row.original._count?.products ?? 0;
      return <div>{count}</div>;
    },
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => {
      return <PurchaseRowActions purchase={row.original} />;
    },
  },
];
