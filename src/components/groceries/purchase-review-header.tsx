"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { CalendarIcon, Pencil, Store, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { updatePurchaseAction } from "@/actions/purchase";
import { PurchaseStatus, PurchaseStatusConfig } from "@/types/purchase";
import type { PurchaseWithProducts, SerializedProduct } from "@/types/purchase";
import { formatCurrency, cn } from "@/lib/utils";
import { clientLogger } from "@/lib/client-logger";

interface PurchaseReviewHeaderProps {
  purchase: PurchaseWithProducts;
  products: SerializedProduct[];
  onUpdate?: () => void;
}

export function PurchaseReviewHeader({ purchase, products, onUpdate }: PurchaseReviewHeaderProps) {
  const [showEditSheet, setShowEditSheet] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [storeName, setStoreName] = useState(purchase.storeName ?? "");
  const [boughtAt, setBoughtAt] = useState<Date | undefined>(
    purchase.boughtAt ? new Date(purchase.boughtAt) : undefined
  );
  const [status, setStatus] = useState<number>(purchase.status ?? PurchaseStatus.NEEDS_REVIEW);
  const [isDismissed, setIsDismissed] = useState(false);

  const statusConfig = purchase.status
    ? PurchaseStatusConfig[purchase.status as keyof typeof PurchaseStatusConfig]
    : PurchaseStatusConfig[PurchaseStatus.NEEDS_REVIEW];

  // Calculate total from products (uses live products state for immediate updates)
  const calculatedTotal = products.reduce((sum, p) => sum + (p.totalValue ?? 0), 0);

  // Mismatch detection: compare product sum against receipt's printed total
  const receiptTotal = purchase.totalValue;
  const MISMATCH_THRESHOLD = 0.01;
  const hasMismatch =
    receiptTotal !== null && Math.abs(calculatedTotal - receiptTotal) > MISMATCH_THRESHOLD;
  const difference = receiptTotal !== null ? calculatedTotal - receiptTotal : 0;
  const showWarning = hasMismatch && !isDismissed;

  // Auto-reset dismissed state when mismatch resolves
  useEffect(() => {
    if (!hasMismatch) {
      setIsDismissed(false);
    }
  }, [hasMismatch]);

  async function handleSubmit() {
    setIsSubmitting(true);

    const result = await updatePurchaseAction(purchase.id, {
      storeName: storeName || null,
      boughtAt: boughtAt?.toISOString() ?? null,
      status,
    });

    if (!result.success) {
      clientLogger.error("Failed to update purchase", result.error, { purchaseId: purchase.id });
      setIsSubmitting(false);
      return;
    }

    if (onUpdate) {
      onUpdate();
    }

    setIsSubmitting(false);
    setShowEditSheet(false);
  }

  return (
    <>
      {/* Mismatch Warning Alert */}
      {showWarning && (
        <Alert variant="destructive" className="relative">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Total Mismatch</AlertTitle>
          <AlertDescription>
            Products sum to {formatCurrency(calculatedTotal)}, but receipt shows{" "}
            {formatCurrency(receiptTotal!)}.{" "}
            {difference > 0 ? (
              <span>Over by {formatCurrency(difference)}.</span>
            ) : (
              <span>Under by {formatCurrency(Math.abs(difference))}.</span>
            )}{" "}
            Please double-check the items manually.
          </AlertDescription>
          <button
            onClick={() => setIsDismissed(true)}
            className="absolute right-2 top-2 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            aria-label="Dismiss warning"
          >
            <X className="h-4 w-4" />
          </button>
        </Alert>
      )}

      <Card>
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="space-y-3">
              {/* Store Name */}
              <div className="flex items-center gap-2">
                <Store className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{purchase.storeName || "Unknown Store"}</span>
              </div>

              {/* Date */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarIcon className="h-4 w-4" />
                <span>
                  {purchase.boughtAt ? format(new Date(purchase.boughtAt), "PPP") : "Unknown date"}
                </span>
              </div>

              {/* Status */}
              <div className="flex items-center gap-2">
                <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
              </div>
            </div>

            {/* Total and Edit */}
            <div className="flex flex-col items-end gap-2">
              <span className="text-2xl font-bold">{formatCurrency(calculatedTotal)}</span>
              {hasMismatch && receiptTotal !== null && (
                <span className="text-xs text-muted-foreground line-through">
                  Receipt: {formatCurrency(receiptTotal)}
                </span>
              )}
              <Button variant="outline" size="sm" onClick={() => setShowEditSheet(true)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Sheet */}
      <Sheet open={showEditSheet} onOpenChange={setShowEditSheet}>
        <SheetContent className="sm:max-w-[425px]">
          <SheetHeader>
            <SheetTitle>Edit Purchase</SheetTitle>
            <SheetDescription>Update the purchase details.</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="storeName">Store Name</Label>
              <Input
                id="storeName"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="Enter store name"
              />
            </div>

            <div className="space-y-2">
              <Label>Purchase Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !boughtAt && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {boughtAt ? format(boughtAt, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={boughtAt} onSelect={setBoughtAt} initialFocus />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status.toString()} onValueChange={(v) => setStatus(parseInt(v, 10))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={PurchaseStatus.APPROVED.toString()}>Approved</SelectItem>
                  <SelectItem value={PurchaseStatus.NEEDS_REVIEW.toString()}>
                    Needs Review
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <SheetFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => setShowEditSheet(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save changes"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
