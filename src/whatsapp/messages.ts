interface GroceryPreviewProduct {
  description: string | null;
  totalValue: number | null;
}

export interface GroceryProposalMessageInput {
  storeName: string | null;
  totalValue: number | null;
  productCount: number;
  products: GroceryPreviewProduct[];
}

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatCurrency(value: number | null): string {
  return value === null ? "não informado" : currencyFormatter.format(value);
}

export function formatGroceryProposalMessage(input: GroceryProposalMessageInput): string {
  const preview = input.products.slice(0, 5);
  const remainingCount = Math.max(input.productCount - preview.length, 0);

  const lines = [
    "🏦 *Kakeibo*",
    "🛒 *Compra importada*",
    "",
    `Mercado: *${input.storeName || "não identificado"}*`,
    `Total: *${formatCurrency(input.totalValue)}*`,
    `Itens: *${input.productCount}*`,
    "",
    "Prévia:",
  ];

  for (const product of preview) {
    lines.push(`• ${product.description || "Item sem nome"} — ${formatCurrency(product.totalValue)}`);
  }

  if (remainingCount > 0) {
    lines.push(`... e mais ${remainingCount} ${remainingCount === 1 ? "item" : "itens"}`);
  }

  lines.push("", "Reaja com ✅ para aprovar ou ❌ para descartar.");

  return lines.join("\n");
}

export function formatAsyncAcknowledgementMessage(): string {
  return [
    "🏦 *Kakeibo*",
    "🛒 *Compra recebida*",
    "",
    "Recebi o cupom e estou lendo os itens.",
  ].join("\n");
}

export function formatApproveConfirmationMessage(storeName: string | null): string {
  return [
    "🏦 *Kakeibo*",
    "✅ *Compra aprovada*",
    "",
    `A compra do *${storeName || "mercado"}* foi confirmada.`,
  ].join("\n");
}

export function formatRejectConfirmationMessage(): string {
  return [
    "🏦 *Kakeibo*",
    "🗑️ *Compra descartada*",
    "",
    "Removi a compra importada e apaguei o cupom temporário.",
  ].join("\n");
}
