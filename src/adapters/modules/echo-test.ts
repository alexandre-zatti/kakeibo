import type { AdapterModule } from "../types";

export const echoTest: AdapterModule = {
  label: "Echo Test",
  description: "Test adapter that creates a dummy expense. For development only.",

  async execute(context) {
    return {
      success: true,
      expense: {
        description: `[Test] Adapter echo - ${context.adapter.name}`,
        amount: 1.0,
        categoryId: 1,
      },
    };
  },
};
