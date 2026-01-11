import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { batchImportRequestSchema } from "@/lib/schemas/batch-import";
import { batchImportPurchases } from "@/services/batch-import";
import logger from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse and validate request body
    const body = await request.json();
    const parseResult = batchImportRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { purchases } = parseResult.data;
    logger.info(
      { userId: session.user.id, purchaseCount: purchases.length },
      "Processing batch import"
    );

    // 3. Import all purchases in a transaction
    const result = await batchImportPurchases(session.user.id, purchases);

    return NextResponse.json({
      success: true,
      purchasesCreated: result.purchasesCreated,
      productsCreated: result.productsCreated,
    });
  } catch (error) {
    logger.error({ error }, "Batch import failed");

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ error: "Failed to import receipts" }, { status: 500 });
  }
}
