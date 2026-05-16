import test from "node:test";
import assert from "node:assert/strict";

import { buildPurchaseCreateDataFromReceipt } from "./grocery-import";
import { PurchaseStatus } from "@/types/purchase";

test("buildPurchaseCreateDataFromReceipt preserves the existing needs-review grocery flow", () => {
  const data = buildPurchaseCreateDataFromReceipt({
    userId: "user-1",
    receiptData: {
      storeName: "Mercado Teste",
      purchaseDate: "2026-05-16",
      totalValue: 12.34,
      products: [
        {
          code: "123",
          description: "Arroz",
          unitValue: 6.17,
          unitIdentifier: "un",
          quantity: 2,
          totalValue: 12.34,
        },
      ],
    },
    now: new Date("2026-05-16T12:00:00.000Z"),
  });

  assert.equal(data.userId, "user-1");
  assert.equal(data.status, PurchaseStatus.NEEDS_REVIEW);
  assert.equal(data.storeName, "Mercado Teste");
  assert.equal(data.totalValue, 12.34);
  assert.equal(data.boughtAt?.toISOString(), "2026-05-16T00:00:00.000Z");
  assert.equal(data.products.create.length, 1);
  assert.equal(data.products.create[0].description, "Arroz");
  assert.equal(data.products.create[0].createdAt.toISOString(), "2026-05-16T12:00:00.000Z");
});

test("buildPurchaseCreateDataFromReceipt can preserve API null date behavior", () => {
  const data = buildPurchaseCreateDataFromReceipt({
    userId: "user-1",
    receiptData: {
      storeName: null,
      purchaseDate: null,
      totalValue: 1.23,
      products: [{ description: "Item", totalValue: 1.23 }],
    },
    fallbackBoughtAt: null,
    now: new Date("2026-05-16T12:00:00.000Z"),
  });

  assert.equal(data.boughtAt, null);
});
