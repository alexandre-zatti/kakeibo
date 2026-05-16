import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { extractReceiptData } from "@/lib/gemini";
import { receiptDataSchema, uploadRequestSchema } from "@/lib/schemas/receipt";
import { createPurchaseFromReceiptData } from "@/services/grocery-import";
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
    const parseResult = uploadRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { images } = parseResult.data;
    logger.info({ userId: session.user.id, imageCount: images.length }, "Processing receipt scan");

    // 3. Send to Gemini API for extraction
    const rawData = await extractReceiptData(images);

    // 4. Validate LLM response with Zod
    const validationResult = receiptDataSchema.safeParse(rawData);
    if (!validationResult.success) {
      logger.error({ error: validationResult.error, rawData }, "LLM response validation failed");
      return NextResponse.json(
        {
          error: "Failed to extract valid receipt data",
          details: validationResult.error.flatten(),
        },
        { status: 422 }
      );
    }

    const receiptData = validationResult.data;

    const purchase = await createPurchaseFromReceiptData({
      userId: session.user.id,
      receiptData,
      fallbackBoughtAt: null,
    });

    logger.info(
      { purchaseId: purchase.id, productCount: purchase.products.length },
      "Receipt saved"
    );

    return NextResponse.json({
      success: true,
      purchase: {
        id: purchase.id,
        storeName: purchase.storeName,
        totalValue: Number(purchase.totalValue),
        boughtAt: purchase.boughtAt,
        productCount: purchase.products.length,
      },
    });
  } catch (error) {
    logger.error({ error }, "Receipt scan failed");

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ error: "Failed to process receipt" }, { status: 500 });
  }
}
