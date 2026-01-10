import { GoogleGenerativeAI } from "@google/generative-ai";
import logger from "./logger";

const apiKey = process.env.GOOGLE_GEMINI_API_KEY;

if (!apiKey) {
  logger.warn("GOOGLE_GEMINI_API_KEY is not set - receipt scanning will not work");
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export const RECEIPT_EXTRACTION_PROMPT = `
You are a receipt OCR and data extraction assistant. Analyze the provided receipt image(s) and extract all purchase information.

IMPORTANT INSTRUCTIONS:
1. If multiple images are provided, they represent ONE SINGLE RECEIPT (possibly a long receipt photographed in multiple parts)
2. Combine all items from all images into a single unified list
3. DEDUPLICATE items that appear in multiple images (overlapping sections)
4. Extract ALL line items visible on the receipt

Return ONLY valid JSON in this exact format (no markdown, no explanation, no code blocks):
{
  "storeName": "Store name if visible, or null",
  "purchaseDate": "YYYY-MM-DD format if visible, or null",
  "totalValue": 123.45,
  "products": [
    {
      "code": "Product code/SKU if visible, or null",
      "description": "Product description/name",
      "unitValue": 10.99,
      "unitIdentifier": "unit type (kg, un, L, etc) or null",
      "quantity": 2,
      "totalValue": 21.98
    }
  ]
}

Rules:
- All monetary values must be numbers (not strings)
- If quantity is not specified, assume 1
- totalValue for each product = unitValue * quantity (or the line total shown on receipt)
- The receipt totalValue should match sum of all product totalValues (or use the printed total)
- Ignore tax breakdowns, subtotals - only include actual products
- For items sold by weight, unitIdentifier should be "kg" or "lb" as appropriate
- Product descriptions should be cleaned up and readable (expand abbreviations when obvious)
`;

/**
 * Extracts receipt data from one or more base64-encoded images using Gemini Flash
 */
export async function extractReceiptData(base64Images: string[]): Promise<unknown> {
  if (!genAI) {
    throw new Error("Gemini API is not configured - missing GOOGLE_GEMINI_API_KEY");
  }

  const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

  const imageParts = base64Images.map((base64Data) => {
    // Detect mime type from base64 header
    let mimeType = "image/jpeg";
    if (base64Data.startsWith("iVBOR")) {
      mimeType = "image/png";
    } else if (base64Data.startsWith("R0lGOD")) {
      mimeType = "image/gif";
    } else if (base64Data.startsWith("UklGR")) {
      mimeType = "image/webp";
    }

    return {
      inlineData: {
        data: base64Data,
        mimeType,
      },
    };
  });

  logger.debug({ imageCount: base64Images.length }, "Sending images to Gemini API");

  const result = await model.generateContent([RECEIPT_EXTRACTION_PROMPT, ...imageParts]);

  const response = result.response;
  const text = response.text();

  logger.debug({ responseLength: text.length }, "Gemini API response received");

  // Parse JSON from response (handle potential markdown wrapping)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    logger.error({ responseText: text }, "No valid JSON found in Gemini response");
    throw new Error("No valid JSON found in Gemini response");
  }

  try {
    return JSON.parse(jsonMatch[0]);
  } catch (parseError) {
    logger.error({ responseText: text, parseError }, "Failed to parse JSON from Gemini response");
    throw new Error("Failed to parse JSON from Gemini response");
  }
}
