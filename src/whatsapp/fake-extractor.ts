import type { ReceiptData } from "@/lib/schemas/receipt";

export function fakeGroceryReceiptData(): ReceiptData {
  return {
    storeName: "Teste Kakeibo",
    purchaseDate: new Date().toISOString().slice(0, 10),
    totalValue: 1.23,
    products: [
      {
        code: "TESTE",
        description: "Item de teste",
        unitValue: 1.23,
        unitIdentifier: "un",
        quantity: 1,
        totalValue: 1.23,
      },
    ],
  };
}
