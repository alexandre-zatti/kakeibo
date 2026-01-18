import type { Purchase, Product } from "@prisma/client";

// Serialized product (Decimal converted to number)
export interface SerializedProduct extends Omit<Product, "unitValue" | "quantity" | "totalValue"> {
  unitValue: number | null;
  quantity: number | null;
  totalValue: number | null;
}

// Purchase with product count (for list views)
// boughtAt is serialized to ISO string for JSON transport
export interface PurchaseWithCount extends Omit<Purchase, "totalValue" | "boughtAt"> {
  totalValue: number | null;
  boughtAt: string | null;
  _count: { products: number };
}

// Purchase with full products array (for detail view)
// boughtAt is serialized to ISO string for JSON transport
export interface PurchaseWithProducts extends Omit<Purchase, "totalValue" | "boughtAt"> {
  totalValue: number | null;
  boughtAt: string | null;
  products: SerializedProduct[];
}

// Status enum for type safety
export const PurchaseStatus = {
  APPROVED: 1,
  NEEDS_REVIEW: 2,
} as const;

export type PurchaseStatusType = (typeof PurchaseStatus)[keyof typeof PurchaseStatus];

// Status display config
export const PurchaseStatusConfig = {
  [PurchaseStatus.APPROVED]: {
    label: "Approved",
    variant: "default" as const,
  },
  [PurchaseStatus.NEEDS_REVIEW]: {
    label: "Needs Review",
    variant: "secondary" as const,
  },
};

// Filter state type for the data table
export interface PurchaseFilters {
  search: string;
  status: PurchaseStatusType | null;
  dateRange: { from: Date | null; to: Date | null };
  priceRange: { min: number | null; max: number | null };
}

// Pagination response type
export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// API response types
export interface PurchaseListResponse {
  data: PurchaseWithCount[];
  pagination: PaginationMeta;
}

export interface PurchaseDetailResponse extends PurchaseWithProducts {}

// Product input type for forms (all fields optional for partial updates)
export interface ProductFormData {
  code?: string | null;
  description: string;
  unitValue?: number | null;
  unitIdentifier?: string | null;
  quantity?: number | null;
  totalValue: number;
}
