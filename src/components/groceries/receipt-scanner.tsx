"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Camera, Upload, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { scanReceiptAction } from "@/actions/purchase";
import { clientLogger } from "@/lib/client-logger";
import { formatCurrency } from "@/lib/utils";

interface ScanSuccess {
  id: number;
  storeName: string | null;
  totalValue: number;
  boughtAt: Date;
  productCount: number;
}

export function ReceiptScanner() {
  const router = useRouter();
  const [images, setImages] = React.useState<string[]>([]);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<ScanSuccess | null>(null);
  const [isLongReceiptMode, setIsLongReceiptMode] = React.useState(false);

  const maxImages = isLongReceiptMode ? 3 : 1;

  const cameraInputRef = React.useRef<HTMLInputElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const remainingSlots = maxImages - images.length;
    const filesToProcess = Array.from(files).slice(0, remainingSlots);

    for (const file of filesToProcess) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        setError("Please select only image files");
        continue;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError("Image files must be under 10MB");
        continue;
      }

      const base64 = await fileToBase64(file);
      setImages((prev) => [...prev, base64]);
    }

    // Reset input to allow selecting the same file again
    e.target.value = "";
    setError(null);
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setError(null);
  };

  const handleLongReceiptModeChange = (checked: boolean) => {
    setIsLongReceiptMode(checked);
    // If disabling long receipt mode and we have more than 1 image, keep only the first
    if (!checked && images.length > 1) {
      setImages((prev) => [prev[0]]);
    }
  };

  const handleSubmit = async () => {
    if (images.length === 0) return;

    setIsProcessing(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await scanReceiptAction(images, isLongReceiptMode);

      if (!result.success) {
        throw new Error(result.error || "Failed to process receipt");
      }

      if (result.data) {
        setSuccess(result.data);
        setImages([]);
        setIsLongReceiptMode(false);
      }
    } catch (err) {
      clientLogger.error("Failed to scan receipt", err);
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleViewPurchase = () => {
    if (success) {
      // Navigate to the groceries page for now
      // Future: router.push(`/groceries/purchases/${success.id}/review`);
      router.push("/groceries");
    }
  };

  const handleScanAnother = () => {
    setSuccess(null);
    setImages([]);
    setError(null);
  };

  // Success state
  if (success) {
    return (
      <div className="flex flex-col gap-4">
        <Card className="bg-green-50 p-4 dark:bg-green-950">
          <div className="flex flex-col gap-2">
            <h3 className="font-semibold text-green-800 dark:text-green-200">
              Receipt Scanned Successfully!
            </h3>
            <div className="text-sm text-green-700 dark:text-green-300">
              {success.storeName && <p>Store: {success.storeName}</p>}
              <p>Total: {formatCurrency(success.totalValue)}</p>
              <p>Items: {success.productCount}</p>
              <p>Date: {new Date(success.boughtAt).toLocaleDateString()}</p>
            </div>
            <p className="mt-2 text-xs text-green-600 dark:text-green-400">
              This purchase has been saved for review. You can approve it later.
            </p>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={handleScanAnother}>
            Scan Another
          </Button>
          <Button onClick={handleViewPurchase}>View Groceries</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Image previews */}
      {images.length > 0 && (
        <div
          className={`mx-auto grid max-w-sm gap-2 ${isLongReceiptMode ? "grid-cols-3" : "grid-cols-1"}`}
        >
          {images.map((img, index) => (
            <Card key={index} className="relative aspect-[3/4] overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`data:image/jpeg;base64,${img}`}
                alt={`Receipt ${index + 1}`}
                className="h-full w-full object-cover"
              />
              <button
                onClick={() => removeImage(index)}
                className="absolute right-1 top-1 rounded-full bg-destructive p-1 text-destructive-foreground shadow-md"
                aria-label={`Remove image ${index + 1}`}
              >
                <X className="h-4 w-4" />
              </button>
            </Card>
          ))}
        </div>
      )}

      {/* Upload buttons */}
      {images.length < maxImages && (
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="h-24 flex-col gap-2"
            onClick={() => cameraInputRef.current?.click()}
            disabled={isProcessing}
          >
            <Camera className="h-8 w-8" />
            <span>Take Photo</span>
          </Button>
          <Button
            variant="outline"
            className="h-24 flex-col gap-2"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
          >
            <Upload className="h-8 w-8" />
            <span>Upload</span>
          </Button>
        </div>
      )}

      {/* Hidden inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleImageSelect}
        className="hidden"
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple={isLongReceiptMode}
        onChange={handleImageSelect}
        className="hidden"
      />

      {/* Long receipt mode toggle */}
      <div className="flex items-center justify-center gap-2">
        <Switch
          id="long-receipt-mode"
          checked={isLongReceiptMode}
          onCheckedChange={handleLongReceiptModeChange}
          disabled={isProcessing}
        />
        <Label htmlFor="long-receipt-mode" className="cursor-pointer text-sm">
          Long receipt (up to 3 photos)
        </Label>
      </div>

      {/* Info text */}
      <p className="text-center text-sm text-muted-foreground">
        {images.length}/{maxImages} photo{maxImages > 1 ? "s" : ""} added
        {isLongReceiptMode &&
          images.length > 0 &&
          images.length < maxImages &&
          " - Add more photos"}
      </p>

      {/* Error display */}
      {error && (
        <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">{error}</div>
      )}

      {/* Submit button */}
      <Button
        onClick={handleSubmit}
        disabled={images.length === 0 || isProcessing}
        className="w-full"
        size="lg"
      >
        {isProcessing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          "Scan Receipt"
        )}
      </Button>

      {/* Helper text */}
      {!isProcessing && images.length === 0 && (
        <p className="text-center text-xs text-muted-foreground">
          {isLongReceiptMode
            ? "Take or upload photos of your grocery receipt. For long receipts, you can add up to 3 photos that will be processed as a single receipt."
            : "Take or upload a photo of your grocery receipt. Enable 'Long receipt' mode if your receipt doesn't fit in one photo."}
        </p>
      )}
    </div>
  );
}

/**
 * Converts a File to base64 string (without data URL prefix)
 */
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix to get just base64
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
