"use client";

import { useState, useEffect } from "react";
import { Plus, Package } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProductRowActions } from "./product-row-actions";
import { ProductCreateSheet } from "./product-create-sheet";
import type { SerializedProduct } from "@/types/purchase";
import { formatCurrency } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface ProductListProps {
  products: SerializedProduct[];
  purchaseId: number;
  editable?: boolean;
  onProductUpdate?: (product: SerializedProduct) => void;
  onProductDelete?: (productId: number) => void;
  onProductCreate?: (product: SerializedProduct) => void;
}

export function ProductList({
  products,
  purchaseId,
  editable = true,
  onProductUpdate,
  onProductDelete,
  onProductCreate,
}: ProductListProps) {
  const [localProducts, setLocalProducts] = useState(products);
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const isMobile = useIsMobile();

  // Determine if state is managed externally (all callbacks provided)
  const isExternallyManaged = !!onProductUpdate && !!onProductDelete && !!onProductCreate;
  const displayProducts = isExternallyManaged ? products : localProducts;

  // Sync local state when props change (only needed for self-managed mode)
  useEffect(() => {
    if (!isExternallyManaged) {
      setLocalProducts(products);
    }
  }, [products, isExternallyManaged]);

  const handleProductUpdate = (updatedProduct: SerializedProduct) => {
    if (onProductUpdate) {
      onProductUpdate(updatedProduct);
    } else {
      setLocalProducts((prev) =>
        prev.map((p) => (p.id === updatedProduct.id ? updatedProduct : p))
      );
    }
  };

  const handleProductDelete = (productId: number) => {
    if (onProductDelete) {
      onProductDelete(productId);
    } else {
      setLocalProducts((prev) => prev.filter((p) => p.id !== productId));
    }
  };

  const handleProductCreate = (newProduct: SerializedProduct) => {
    if (onProductCreate) {
      onProductCreate(newProduct);
    } else {
      setLocalProducts((prev) => [...prev, newProduct]);
    }
  };

  if (displayProducts.length === 0 && !editable) {
    return (
      <div className="flex h-24 items-center justify-center rounded-md border border-dashed">
        <p className="text-sm text-muted-foreground">No products in this purchase.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Add button */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          Products ({displayProducts.length})
        </h3>
        {editable && (
          <Button variant="outline" size="sm" onClick={() => setShowCreateSheet(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </Button>
        )}
      </div>

      {/* Empty state */}
      {displayProducts.length === 0 && editable && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed py-8">
          <Package className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No products yet. Add your first product.</p>
          <Button variant="outline" size="sm" onClick={() => setShowCreateSheet(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </Button>
        </div>
      )}

      {/* Mobile: Card layout */}
      {displayProducts.length > 0 && isMobile && (
        <div className="space-y-3">
          {displayProducts.map((product) => (
            <Card key={product.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-1">
                    <p className="font-medium leading-tight">
                      {product.description || "Unnamed product"}
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      {product.quantity && (
                        <span>
                          {product.quantity} {product.unitIdentifier || "un"}
                        </span>
                      )}
                      {product.unitValue && <span>@ {formatCurrency(product.unitValue)}</span>}
                      {product.code && <span className="font-mono text-xs">{product.code}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">
                      {product.totalValue !== null ? formatCurrency(product.totalValue) : "-"}
                    </span>
                    {editable && (
                      <ProductRowActions
                        product={product}
                        purchaseId={purchaseId}
                        onUpdate={handleProductUpdate}
                        onDelete={() => handleProductDelete(product.id)}
                      />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Desktop: Table layout */}
      {displayProducts.length > 0 && !isMobile && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead className="w-[80px] text-right">Qty</TableHead>
                <TableHead className="w-[60px]">Unit</TableHead>
                <TableHead className="w-[100px] text-right">Unit Price</TableHead>
                <TableHead className="w-[100px] text-right">Total</TableHead>
                {editable && <TableHead className="w-[50px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {product.description || "Unnamed product"}
                      </span>
                      {product.code && (
                        <span className="font-mono text-xs text-muted-foreground">
                          {product.code}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{product.quantity ?? "-"}</TableCell>
                  <TableCell>{product.unitIdentifier || "-"}</TableCell>
                  <TableCell className="text-right">
                    {product.unitValue !== null ? formatCurrency(product.unitValue) : "-"}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {product.totalValue !== null ? formatCurrency(product.totalValue) : "-"}
                  </TableCell>
                  {editable && (
                    <TableCell>
                      <ProductRowActions
                        product={product}
                        purchaseId={purchaseId}
                        onUpdate={handleProductUpdate}
                        onDelete={() => handleProductDelete(product.id)}
                      />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create sheet */}
      <ProductCreateSheet
        purchaseId={purchaseId}
        open={showCreateSheet}
        onOpenChange={setShowCreateSheet}
        onSuccess={handleProductCreate}
      />
    </div>
  );
}
