/**
 * Parser for Google Sheets migration data.
 * Handles BRL currency parsing, monthly tab structure, and Caixinhas tab structure.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParsedMonth {
  year: number;
  month: number;
  sheetName: string;
  totalIncome: number;
  expenses: ParsedExpense[];
  caixinhaContributions: ParsedMonthCaixinha[];
}

export interface ParsedExpense {
  description: string;
  amount: number;
  isPaid: boolean;
}

export interface ParsedMonthCaixinha {
  boxName: string;
  amount: number;
}

export interface ParsedCaixinhaBox {
  name: string;
  monthlyTarget: number | null;
  goalAmount: number | null;
  currentBalance: number;
  transactions: ParsedCaixinhaTransaction[];
}

export interface ParsedCaixinhaTransaction {
  date: string; // "MM/YYYY"
  amount: number; // positive = contribution, negative = withdrawal
  description: string | null;
}

export interface MonthlySheetData {
  sheet: string;
  year: number;
  month: number;
  data: string[][];
}

export interface CaixinhasSheetData {
  sheet: string;
  data: string[][];
}

// ─── BRL Parsing ──────────────────────────────────────────────────────────────

/**
 * Parse a BRL currency string to a number.
 * Handles formats: "R$1,300.00", "-R$150.00", "R$0.00", empty strings
 */
export function parseBRL(str: string | undefined | null): number {
  if (!str || str.trim() === "") return 0;

  const cleaned = str.trim();
  const isNegative = cleaned.startsWith("-");

  // Remove R$, commas, spaces, and leading dash
  const numStr = cleaned.replace(/[-R$\s,]/g, "");

  if (!numStr || numStr === "") return 0;

  const value = parseFloat(numStr);
  if (isNaN(value)) return 0;

  return isNegative ? -value : value;
}

// ─── Monthly Tab Parser ───────────────────────────────────────────────────────

/**
 * Parse a single monthly tab's data into structured format.
 *
 * Monthly tab structure:
 * - Row 0: Summary headers (4 or 5 columns)
 * - Row 1: Summary values (BRL formatted)
 * - Row 2: Column headers ("Despesa", "Valor", "Status", "Caixinha", "Valor")
 * - Row 3+: Expense rows (col A=description, B=amount, C=status) + Caixinha contributions (D=name, E=amount)
 */
export function parseMonthlyTab(monthData: MonthlySheetData): ParsedMonth {
  const { year, month, sheet, data } = monthData;

  // Row 1 (index 1) has summary values
  const summaryRow = data[1] || [];
  const totalIncome = parseBRL(summaryRow[0]); // "Total Entrada" is always first

  // Rows 3+ (index 3+) have expense and caixinha data
  const expenses: ParsedExpense[] = [];
  const caixinhaContributions: ParsedMonthCaixinha[] = [];

  for (let i = 3; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    // Parse expense (cols A-C)
    const description = (row[0] || "").trim();
    const amount = parseBRL(row[1]);
    const status = (row[2] || "").trim().toUpperCase();

    if (description && amount > 0) {
      expenses.push({
        description,
        amount,
        isPaid: status === "PAGO",
      });
    }

    // Parse caixinha contribution (cols D-E)
    const boxName = (row[3] || "").trim();
    const boxAmount = parseBRL(row[4]);

    if (boxName && boxAmount > 0) {
      caixinhaContributions.push({
        boxName,
        amount: boxAmount,
      });
    }
  }

  return {
    year,
    month,
    sheetName: sheet,
    totalIncome,
    expenses,
    caixinhaContributions,
  };
}

// ─── Caixinhas Tab Parser ─────────────────────────────────────────────────────

/**
 * Parse the Caixinhas tab into structured savings box data.
 *
 * Structure: 4 boxes side-by-side, each occupying 4 columns (3 data + 1 separator):
 * - Box 1 (Nenês): cols 0-3
 * - Box 2 (Casa): cols 4-7
 * - Box 3 (Ferias): cols 8-11
 * - Box 4 (Passaporte): cols 12-15
 *
 * Row 0: Headers like "Nenês | 200/Mês"
 * Row 1: "Meta", "Atual", "Faltam"
 * Row 2: Values
 * Row 3: "Aportes"
 * Row 4: "Mês", "Valor"
 * Row 5+: Transaction history (date, amount, [empty], [note])
 */
export function parseCaixinhasTab(caixinhasData: CaixinhasSheetData): ParsedCaixinhaBox[] {
  const { data } = caixinhasData;
  const boxes: ParsedCaixinhaBox[] = [];
  const boxOffsets = [0, 4, 8, 12]; // Column offsets for each box

  for (const offset of boxOffsets) {
    // Parse header: "Nenês | 200/Mês" or "Passaporte | 300/Mês"
    const header = (data[0]?.[offset] || "").trim();
    if (!header) continue;

    const headerMatch = header.match(/^(.+?)\s*\|\s*(\d+)\/Mês$/);
    const name = headerMatch ? headerMatch[1].trim() : header;
    const monthlyTarget = headerMatch ? parseInt(headerMatch[2]) : null;

    // Parse current balance from row 2
    const currentBalance = parseBRL(data[2]?.[offset + 1]); // "Atual" column

    // Parse goal amount from row 2 if available
    const goalStr = data[2]?.[offset]; // "Meta" column
    const goalAmount = goalStr && goalStr !== "N/A" ? parseBRL(goalStr) : null;

    // Parse transaction history (row 5+)
    const transactions: ParsedCaixinhaTransaction[] = [];
    for (let i = 5; i < data.length; i++) {
      const row = data[i];
      if (!row) continue;

      const dateStr = (row[offset] || "").trim();
      const amountStr = (row[offset + 1] || "").trim();
      const noteStr = (row[offset + 3] || "").trim(); // Notes are in the 4th column of each section

      if (!dateStr || !amountStr) continue;

      // Validate date format (MM/YYYY)
      if (!/^\d{2}\/\d{4}$/.test(dateStr)) continue;

      const amount = parseBRL(amountStr);
      if (amount === 0) continue;

      transactions.push({
        date: dateStr,
        amount,
        description: noteStr || null,
      });
    }

    boxes.push({
      name,
      monthlyTarget,
      goalAmount,
      currentBalance,
      transactions,
    });
  }

  return boxes;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Collect all unique expense descriptions across all months.
 */
export function collectUniqueDescriptions(months: ParsedMonth[]): string[] {
  const descriptions = new Set<string>();
  for (const month of months) {
    for (const expense of month.expenses) {
      descriptions.add(expense.description.toLowerCase().trim());
    }
  }
  return Array.from(descriptions).sort();
}

/**
 * Map a caixinha date string to year/month.
 */
export function parseCaixinhaDate(dateStr: string): { year: number; month: number } | null {
  const match = dateStr.match(/^(\d{2})\/(\d{4})$/);
  if (!match) return null;
  return { month: parseInt(match[1]), year: parseInt(match[2]) };
}
