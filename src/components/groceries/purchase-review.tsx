"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Camera, Trash2, Check, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PurchaseReviewHeader } from "./purchase-review-header";
import { ProductList } from "@/components/products/product-list";
import { updatePurchaseAction, deletePurchaseAction } from "@/actions/purchase";
import { PurchaseStatus } from "@/types/purchase";
import type { PurchaseWithProducts, SerializedProduct } from "@/types/purchase";
import { clientLogger } from "@/lib/client-logger";

interface PurchaseReviewProps {
  purchase: PurchaseWithProducts;
  scannedImages?: string[];
  onScanAnother: () => void;
  onDeleted?: () => void;
}

export function PurchaseReview({
  purchase,
  scannedImages,
  onScanAnother,
  onDeleted,
}: PurchaseReviewProps) {
  const [showImages, setShowImages] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [products, setProducts] = useState<SerializedProduct[]>(purchase.products);

  // Sync products state when purchase prop changes (e.g., after server refresh)
  useEffect(() => {
    setProducts(purchase.products);
  }, [purchase.products]);

  const handleProductUpdate = (updatedProduct: SerializedProduct) => {
    setProducts((prev) => prev.map((p) => (p.id === updatedProduct.id ? updatedProduct : p)));
  };

  const handleProductDelete = (productId: number) => {
    setProducts((prev) => prev.filter((p) => p.id !== productId));
  };

  const handleProductCreate = (newProduct: SerializedProduct) => {
    setProducts((prev) => [...prev, newProduct]);
  };

  const isApproved = purchase.status === PurchaseStatus.APPROVED;

  async function handleApprove() {
    setIsApproving(true);

    const result = await updatePurchaseAction(purchase.id, {
      status: PurchaseStatus.APPROVED,
    });

    if (!result.success) {
      clientLogger.error("Failed to approve purchase", result.error, { purchaseId: purchase.id });
      setIsApproving(false);
      return;
    }

    setIsApproving(false);
    onScanAnother();
  }

  async function handleDelete() {
    setIsDeleting(true);

    const result = await deletePurchaseAction(purchase.id);

    if (!result.success) {
      clientLogger.error("Failed to delete purchase", result.error, { purchaseId: purchase.id });
      setIsDeleting(false);
      return;
    }

    setIsDeleting(false);
    setShowDeleteDialog(false);

    if (onDeleted) {
      onDeleted();
    } else {
      onScanAnother();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Scanned Images (collapsible) */}
      {scannedImages && scannedImages.length > 0 && (
        <Collapsible open={showImages} onOpenChange={setShowImages}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between" size="sm">
              <span className="flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Scanned Images ({scannedImages.length})
              </span>
              {showImages ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div
              className={`mx-auto grid max-w-sm gap-2 ${
                scannedImages.length > 1 ? "grid-cols-3" : "grid-cols-1"
              }`}
            >
              {scannedImages.map((img, index) => (
                <Card key={index} className="relative aspect-[3/4] overflow-hidden">
                  {/* Native <img> required: Next.js Image doesn't support data URLs in src.
                      These are temporary base64 previews that don't benefit from optimization. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`data:image/jpeg;base64,${img}`}
                    alt={`Scanned receipt ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                </Card>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Purchase Header (editable) */}
      <PurchaseReviewHeader purchase={purchase} products={products} />

      {/* Product List (full CRUD) */}
      <ProductList
        products={products}
        purchaseId={purchase.id}
        editable={true}
        onProductUpdate={handleProductUpdate}
        onProductDelete={handleProductDelete}
        onProductCreate={handleProductCreate}
      />

      {/* Action Buttons */}
      <div className="flex flex-col gap-3 pt-4">
        {/* Primary actions row */}
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={onScanAnother}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Scan Another
          </Button>
          <Button
            onClick={handleApprove}
            disabled={isApproving || isApproved}
            variant={isApproved ? "secondary" : "default"}
          >
            {isApproving ? (
              "Approving..."
            ) : isApproved ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Approved
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Approve
              </>
            )}
          </Button>
        </div>

        {/* Delete action */}
        <Button
          variant="ghost"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => setShowDeleteDialog(true)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete Purchase
        </Button>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Purchase</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this purchase? This will also delete all{" "}
              {products.length} product{products.length !== 1 ? "s" : ""} associated with it. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
