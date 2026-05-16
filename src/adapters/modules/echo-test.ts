import type { AdapterModule } from "../types";

function getCategoryId(config: unknown): number {
  if (
    config &&
    typeof config === "object" &&
    "categoryId" in config &&
    typeof config.categoryId === "number"
  ) {
    return config.categoryId;
  }

  return 1;
}

export const echoTest: AdapterModule = {
  label: "Echo Test",
  description: "Test adapter that creates a dummy expense. For development only.",

  async execute(context) {
    const categoryId = getCategoryId(context.adapter.config);

    if (context.targetExpenseId) {
      return {
        success: true,
        actions: [
          {
            type: "update_expense" as const,
            expenseId: context.targetExpenseId,
            data: {
              description: `[Test] Adapter echo - ${context.adapter.name}`,
              amount: 1.0,
              categoryId,
            },
          },
        ],
      };
    }

    return {
      success: true,
      actions: [
        {
          type: "create_expense" as const,
          data: {
            description: `[Test] Adapter echo - ${context.adapter.name}`,
            amount: 1.0,
            categoryId,
          },
        },
      ],
    };
  },
};
