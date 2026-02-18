/**
 * AI-powered expense categorization using Google Gemini.
 * Takes unique expense descriptions and maps them to predefined categories.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

// The standard expense categories (must match what seedDefaultCategories creates)
const EXPENSE_CATEGORIES = [
  "Moradia", // Housing: rent, condo, utilities, internet, home maintenance
  "Transporte", // Transport: gas, car insurance, car maintenance, IPVA, tolls
  "Alimentacao", // Food: groceries, restaurants, delivery, snacks
  "Lazer", // Leisure: entertainment, streaming, outings, gifts
  "Pets", // Pets: food, vet, supplies, grooming
  "Seguros", // Insurance: car insurance, health insurance
  "Taxas", // Fees/taxes: bank fees, IPVA, fines, government fees
];

// Manual mapping for common known descriptions (case-insensitive)
// This serves as a fast path and fallback if Gemini is unavailable
const MANUAL_MAP: Record<string, string> = {
  aluguel: "Moradia",
  condominio: "Moradia",
  condomínio: "Moradia",
  luz: "Moradia",
  internet: "Moradia",
  agua: "Moradia",
  "agua e suporte": "Moradia",
  "inst. chuveiro": "Moradia",
  "resistência chuveiro": "Moradia",
  "cont portao": "Moradia",
  torneira: "Moradia",
  varais: "Moradia",
  "kit banheiro": "Moradia",
  tampas: "Moradia",
  "tampa de panela conserto": "Moradia",
  esponjas: "Moradia",
  "velas filtro barro": "Moradia",

  "gasolina beto": "Transporte",
  gasosa: "Transporte",
  "seguro carro": "Seguros",
  "ipva beto": "Taxas",
  ipva: "Taxas",
  "licencia. beto": "Taxas",
  "vistoria beto": "Taxas",
  "detran beto": "Taxas",
  "multa beto": "Taxas",
  "banho beto": "Transporte",
  "beto banho": "Transporte",
  beto: "Transporte",

  "teleone mozi": "Moradia",
  "telefone mozi": "Moradia",

  "tarifa bb": "Taxas",
  "tarifa idk": "Taxas",
  "conta bb": "Taxas",

  netflix: "Lazer",

  "supply nenês": "Pets",
  "supply nenes": "Pets",
  "banheiro nenês": "Pets",
  "brinquedo nenês": "Pets",
  "comida nenes": "Pets",
  "comidinhas nenes": "Pets",
  "doação gatinhos": "Pets",
  "doacao gatinhos": "Pets",
  "nenes( convertido para gasolina)": "Pets",

  mercado: "Alimentacao",
  "compras stock": "Alimentacao",
  "compras start": "Alimentacao",
  "start atacado": "Alimentacao",
  pizza: "Alimentacao",
  pastel: "Alimentacao",
  "big pastel": "Alimentacao",
  "big pastel ": "Alimentacao",
  restaurante: "Alimentacao",
  "canto restaurante": "Alimentacao",
  queijo: "Alimentacao",
  sushi: "Alimentacao",
  subway: "Alimentacao",
  mel: "Alimentacao",
  jantar: "Alimentacao",
  almoço: "Alimentacao",
  cafeteria: "Alimentacao",
  café: "Alimentacao",
  comidinhas: "Alimentacao",
  "five burger": "Alimentacao",
  "five burg": "Alimentacao",
  five: "Alimentacao",
  fratelli: "Alimentacao",
  "nice brasa": "Alimentacao",
  "nanda cake": "Alimentacao",
  nandacafe: "Alimentacao",
  bonissima: "Alimentacao",
  "suco matte": "Alimentacao",
  "quiero cafe": "Alimentacao",
  mirante: "Alimentacao",
  "limpeza yvy": "Alimentacao",
  yvy: "Alimentacao",

  farmacia: "Lazer",
  farmácia: "Lazer",
  "farmácia ": "Lazer",
  "lamina liqui": "Lazer",
  "positiv.a": "Lazer",
  desemgripante: "Lazer",
  "bebel presentes": "Lazer",
  "samuel e karen presente": "Lazer",
  casamento: "Lazer",
  "cartorio casamento": "Taxas",

  doação: "Lazer",
  "doacao rifa": "Lazer",
  "doação ong": "Lazer",
  "pix unknown": "Lazer",
  "n identificado": "Lazer",
  mozao: "Lazer",
  "ale mozi": "Lazer",
  ale: "Lazer",
  "saque em ferias": "Lazer",
  camisinhas: "Lazer",
  "camisinhas ": "Lazer",
  oculos: "Lazer",
  óculos: "Lazer",
};

export type CategoryMapping = Record<string, string>;

/**
 * Categorize expense descriptions using Gemini AI.
 * Falls back to manual mapping if Gemini is unavailable.
 */
export async function categorizeExpenses(descriptions: string[]): Promise<CategoryMapping> {
  const mapping: CategoryMapping = {};
  const uncategorized: string[] = [];

  // First pass: use manual mapping for known descriptions
  for (const desc of descriptions) {
    const key = desc.toLowerCase().trim();
    if (MANUAL_MAP[key]) {
      mapping[key] = MANUAL_MAP[key];
    } else {
      uncategorized.push(desc);
    }
  }

  console.log(`Manual mapping: ${Object.keys(mapping).length}/${descriptions.length} categorized`);

  // Second pass: use Gemini for remaining descriptions
  if (uncategorized.length > 0) {
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;

    if (apiKey) {
      try {
        const aiMapping = await categorizeWithGemini(uncategorized, apiKey);
        for (const [desc, category] of Object.entries(aiMapping)) {
          mapping[desc.toLowerCase().trim()] = category;
        }
        console.log(`Gemini categorized ${Object.keys(aiMapping).length} remaining descriptions`);
      } catch (error) {
        console.error("Gemini categorization failed, using fallback:", error);
        // Fallback: assign "Outros" category to uncategorized items
        for (const desc of uncategorized) {
          mapping[desc.toLowerCase().trim()] = "Lazer";
        }
      }
    } else {
      console.warn("No GOOGLE_GEMINI_API_KEY - assigning uncategorized as 'Lazer'");
      for (const desc of uncategorized) {
        mapping[desc.toLowerCase().trim()] = "Lazer";
      }
    }
  }

  return mapping;
}

async function categorizeWithGemini(
  descriptions: string[],
  apiKey: string
): Promise<CategoryMapping> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `You are categorizing Brazilian household expense descriptions into predefined categories.

Categories:
- Moradia: rent, condo fees, utilities (electricity, water), internet, phone bills, home maintenance/repairs
- Transporte: gasoline, car maintenance, parking, tolls, Uber/taxi, car wash
- Alimentacao: groceries, restaurants, delivery, bakeries, snacks, drinks, supermarket
- Lazer: entertainment, streaming services, outings, gifts, personal care, pharmacy, clothing
- Pets: pet food, vet bills, pet supplies, grooming
- Seguros: car insurance, health insurance, life insurance
- Taxas: bank fees, government fees (IPVA, IPTU), fines, taxes, licenses

For each description below, return ONLY a JSON object mapping the description (lowercased) to its category.
No explanation, no markdown, just the JSON object.

Descriptions to categorize:
${descriptions.map((d) => `- "${d}"`).join("\n")}

Return format: {"description1": "Category", "description2": "Category", ...}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  // Parse JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No valid JSON in Gemini response");
  }

  const parsed = JSON.parse(jsonMatch[0]) as CategoryMapping;

  // Validate categories
  for (const [desc, category] of Object.entries(parsed)) {
    if (!EXPENSE_CATEGORIES.includes(category)) {
      parsed[desc] = "Lazer"; // Default fallback
    }
  }

  return parsed;
}

/**
 * Get the category for a specific expense description.
 */
export function getCategoryForExpense(description: string, mapping: CategoryMapping): string {
  return mapping[description.toLowerCase().trim()] || "Lazer";
}
