import test from "node:test";
import assert from "node:assert/strict";

import { getHelpMessage, parseCommand } from "./command-registry";
import { formatGroceryProposalMessage } from "./messages";

test("parseCommand accepts only a registered command as the first token", () => {
  assert.deepEqual(parseCommand("/new-grocery angeloni maio"), {
    name: "/new-grocery",
    note: "angeloni maio",
  });

  assert.equal(parseCommand("vamos comprar mercado?"), null);
  assert.equal(parseCommand("/new-groceries"), null);
});

test("help is generated from the command registry", () => {
  const help = getHelpMessage();

  assert.match(help, /🏦 \*Kakeibo\*/);
  assert.match(help, /\/help/);
  assert.match(help, /\/new-grocery/);
  assert.match(help, /✅/);
  assert.match(help, /❌/);
});

test("grocery proposal message is compact and does not expose internal ids", () => {
  const message = formatGroceryProposalMessage({
    storeName: "Teste Kakeibo",
    totalValue: 1.23,
    productCount: 7,
    products: [
      { description: "Item 1", totalValue: 1 },
      { description: "Item 2", totalValue: 2 },
      { description: "Item 3", totalValue: 3 },
      { description: "Item 4", totalValue: 4 },
      { description: "Item 5", totalValue: 5 },
      { description: "Item 6", totalValue: 6 },
    ],
  });

  assert.match(message, /🏦 \*Kakeibo\*/);
  assert.match(message, /Reaja com ✅/);
  assert.match(message, /\.\.\. e mais 2 itens/);
  assert.doesNotMatch(message, /KG-/);
  assert.doesNotMatch(message, /Origem:/);
  assert.doesNotMatch(message, /Item 6/);
});
