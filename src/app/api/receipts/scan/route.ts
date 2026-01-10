import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractReceiptData } from "@/lib/gemini";
import { receiptDataSchema, uploadRequestSchema } from "@/lib/schemas/receipt";
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

    // 5. Parse date if provided
    let boughtAt: Date | null = null;
    if (receiptData.purchaseDate) {
      const parsed = new Date(receiptData.purchaseDate);
      if (!isNaN(parsed.getTime())) {
        boughtAt = parsed;
      }
    }

    // 6. Save to database with status=2 (needs review)
    const purchase = await prisma.purchase.create({
      data: {
        userId: session.user.id,
        status: 2, // needs_review
        totalValue: receiptData.totalValue,
        storeName: receiptData.storeName,
        boughtAt,
        createdAt: new Date(),
        updatedAt: new Date(),
        products: {
          create: receiptData.products.map((product) => ({
            code: product.code,
            description: product.description,
            unitValue: product.unitValue,
            unitIdentifier: product.unitIdentifier,
            quantity: product.quantity,
            totalValue: product.totalValue,
            createdAt: new Date(),
            updatedAt: new Date(),
          })),
        },
      },
      include: { products: true },
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
