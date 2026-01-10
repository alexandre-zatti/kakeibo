"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Camera, Upload, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { scanReceiptAction } from "@/actions/purchase";
import { clientLogger } from "@/lib/client-logger";

interface ScanSuccess {
  id: number;
  storeName: string | null;
  totalValue: number;
  boughtAt: Date | null;
  productCount: number;
}

export function ReceiptScanner() {
  const router = useRouter();
  const [images, setImages] = React.useState<string[]>([]);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<ScanSuccess | null>(null);

  const cameraInputRef = React.useRef<HTMLInputElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const remainingSlots = 3 - images.length;
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

  const handleSubmit = async () => {
    if (images.length === 0) return;

    setIsProcessing(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await scanReceiptAction(images);

      if (!result.success) {
        throw new Error(result.error || "Failed to process receipt");
      }

      if (result.data) {
        setSuccess(result.data);
        setImages([]);
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
              <p>Total: ${success.totalValue.toFixed(2)}</p>
              <p>Items: {success.productCount}</p>
              {success.boughtAt && <p>Date: {new Date(success.boughtAt).toLocaleDateString()}</p>}
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
        <div className="grid grid-cols-3 gap-2">
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
      {images.length < 3 && (
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
        multiple
        onChange={handleImageSelect}
        className="hidden"
      />

      {/* Info text */}
      <p className="text-center text-sm text-muted-foreground">
        {images.length}/3 photos added
        {images.length > 0 && images.length < 3 && " - Add more for long receipts"}
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
          Take or upload photos of your grocery receipt. For long receipts, you can add up to 3
          photos.
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
