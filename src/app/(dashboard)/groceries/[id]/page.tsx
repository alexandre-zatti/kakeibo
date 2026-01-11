import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft, Store, Calendar, Banknote, Package } from "lucide-react";
import { auth } from "@/lib/auth";
import { getPurchaseById } from "@/services/purchase";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PurchaseDetailActions } from "@/components/purchases/purchase-detail-actions";
import { PurchaseStatus, PurchaseStatusConfig } from "@/types/purchase";

interface PurchaseDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function PurchaseDetailPage({ params }: PurchaseDetailPageProps) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { id } = await params;
  const purchaseId = parseInt(id, 10);

  if (isNaN(purchaseId)) {
    notFound();
  }

  const purchase = await getPurchaseById(purchaseId, session.user.id);

  if (!purchase) {
    notFound();
  }

  const status = purchase.status;
  const config = status
    ? PurchaseStatusConfig[status as keyof typeof PurchaseStatusConfig] ||
      PurchaseStatusConfig[PurchaseStatus.NEEDS_REVIEW]
    : null;
  const totalValue = purchase.totalValue;
  const date = purchase.boughtAt;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/groceries">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back to groceries</span>
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{purchase.storeName || "Unknown Store"}</h1>
            <p className="text-muted-foreground">Purchase details</p>
          </div>
        </div>
        <PurchaseDetailActions purchase={purchase} />
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Store</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{purchase.storeName || "Unknown"}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Date</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {date ? format(date, "MMM d, yyyy") : "Unknown"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Banknote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {totalValue !== null ? formatCurrency(totalValue) : "Unknown"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {config ? (
              <Badge variant={config.variant} className="text-sm">
                {config.label}
              </Badge>
            ) : (
              <span className="text-lg font-bold">Unknown</span>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Products table */}
      <Card>
        <CardHeader>
          <CardTitle>Products</CardTitle>
          <CardDescription>
            {purchase.products.length} item{purchase.products.length !== 1 ? "s" : ""} in this
            purchase
          </CardDescription>
        </CardHeader>
        <CardContent>
          {purchase.products.length === 0 ? (
            <div className="flex h-24 items-center justify-center rounded-md border border-dashed">
              <p className="text-sm text-muted-foreground">No products recorded.</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchase.products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">
                        {product.description || "Unknown Product"}
                        {product.code && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            ({product.code})
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{product.quantity ?? "-"}</TableCell>
                      <TableCell>{product.unitIdentifier || "-"}</TableCell>
                      <TableCell className="text-right">
                        {product.unitValue !== null ? formatCurrency(product.unitValue) : "-"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {product.totalValue !== null ? formatCurrency(product.totalValue) : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
