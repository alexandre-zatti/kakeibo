import { ReceiptScanner } from "@/components/groceries/receipt-scanner";

export default function ScanReceiptPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Scan Receipt</h1>
        <p className="text-muted-foreground">
          Upload or take photos of your receipt to automatically extract items
        </p>
      </div>
      <ReceiptScanner />
    </div>
  );
}
