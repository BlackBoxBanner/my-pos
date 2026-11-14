import { invoke } from "@tauri-apps/api/core";

export type Product = {
  id: number;
  name: string;
  barcode: string | null;
  priceSatang: number;
  stockQty: number;
  lowStockQty: number;
  active: boolean;
  pinned: boolean;
  pinOrder: number;
};

export type ProductPage = {
  items: Product[];
  total: number;
  limit: number;
  offset: number;
};

export type CreateProductInput = {
  name: string;
  barcode: string | null;
  priceSatang: number;
  stockQty: number;
  lowStockQty: number;
  active: boolean;
};

export type ImportProductsResult = {
  created: number;
  updated: number;
  errors: string[];
};

export type UpdateProductInput = {
  name: string;
  barcode: string | null;
  priceSatang: number;
  lowStockQty: number;
  active: boolean;
};

export type CheckoutLine = {
  productId: number;
  qty: number;
};

export type SaleItem = {
  id: number;
  saleId: number;
  productId: number;
  name: string;
  qty: number;
  unitPriceSatang: number;
  lineTotalSatang: number;
};

export type Sale = {
  id: number;
  receiptNo: string;
  totalSatang: number;
  paidSatang: number;
  changeSatang: number;
  createdAt: string;
  status: string;
  voidedAt: string | null;
  items: SaleItem[];
};

export type SaleSummary = {
  id: number;
  receiptNo: string;
  totalSatang: number;
  paidSatang: number;
  changeSatang: number;
  createdAt: string;
  status: string;
  voidedAt: string | null;
};

export type TodayReport = {
  businessDate: string;
  saleCount: number;
  totalSatang: number;
  dayClosed: boolean;
  sales: SaleSummary[];
};

export type DayClose = {
  id: number;
  businessDate: string;
  saleCount: number;
  totalSatang: number;
  closedAt: string;
};

export type StockMovement = {
  id: number;
  productId: number;
  productName: string;
  qtyDelta: number;
  reason: string;
  note: string | null;
  createdAt: string;
};

export type ShopSettings = {
  shopName: string;
  shopAddress: string;
  autoPrint: boolean;
  soundEnabled: boolean;
  onboardingDone: boolean;
};

export function listProducts(
  query?: string,
  includeInactive = false,
): Promise<Product[]> {
  return invoke("list_products", {
    query: query ?? null,
    includeInactive,
  });
}

export function listProductsPage(
  query?: string,
  includeInactive = false,
  limit = 50,
  offset = 0,
): Promise<ProductPage> {
  return invoke("list_products_page", {
    query: query ?? null,
    includeInactive,
    limit,
    offset,
  });
}

export function getLowStockCount(): Promise<number> {
  return invoke("get_low_stock_count");
}

export function getProductsByIds(ids: number[]): Promise<Product[]> {
  return invoke("get_products_by_ids", { ids });
}

export function getProductByBarcode(barcode: string): Promise<Product | null> {
  return invoke("get_product_by_barcode", { barcode });
}

export function createProduct(input: CreateProductInput): Promise<Product> {
  return invoke("create_product", { input });
}

export function importProducts(
  rows: CreateProductInput[],
): Promise<ImportProductsResult> {
  return invoke("import_products", { rows });
}

export function updateProduct(
  id: number,
  input: UpdateProductInput,
): Promise<Product> {
  return invoke("update_product", { id, input });
}

export function deleteProduct(id: number): Promise<void> {
  return invoke("delete_product", { id });
}

export function setProductPinned(
  id: number,
  pinned: boolean,
): Promise<Product> {
  return invoke("set_product_pinned", { id, pinned });
}

export function receiveStock(
  productId: number,
  qty: number,
  note?: string,
): Promise<Product> {
  return invoke("receive_stock", {
    productId,
    qty,
    note: note ?? null,
  });
}

export function adjustStock(
  productId: number,
  newQty: number,
  note?: string,
): Promise<Product> {
  return invoke("adjust_stock", {
    productId,
    newQty,
    note: note ?? null,
  });
}

export function listStockMovements(limit = 50): Promise<StockMovement[]> {
  return invoke("list_stock_movements", { limit });
}

export function checkout(
  lines: CheckoutLine[],
  paidSatang: number,
): Promise<Sale> {
  return invoke("checkout", { lines, paidSatang });
}

export function getTodayReport(): Promise<TodayReport> {
  return invoke("get_today_report");
}

export function getSale(id: number): Promise<Sale> {
  return invoke("get_sale", { id });
}

export function closeDay(): Promise<DayClose> {
  return invoke("close_day");
}

export function listDayCloses(): Promise<DayClose[]> {
  return invoke("list_day_closes");
}

export function voidSale(id: number): Promise<Sale> {
  return invoke("void_sale", { id });
}

export function backupDatabase(): Promise<string> {
  return invoke("backup_database");
}

export function getDataDir(): Promise<string> {
  return invoke("get_data_dir");
}

export function getShopSettings(): Promise<ShopSettings> {
  return invoke("get_shop_settings");
}

export function setShopSettings(settings: ShopSettings): Promise<ShopSettings> {
  return invoke("set_shop_settings", { settings });
}

export function exportProductsCsv(includeInactive = true): Promise<string> {
  return invoke("export_products_csv", { includeInactive });
}

export function errorMessage(err: unknown): string {
  if (typeof err === "string") {
    if (err.includes("invoke") || err.includes("undefined")) {
      return "เปิดแอปด้วย npm run tauri dev (ไม่ใช่แค่เบราว์เซอร์)";
    }
    return err;
  }
  if (err instanceof Error) {
    if (err.message.includes("invoke") || err.message.includes("undefined")) {
      return "เปิดแอปด้วย npm run tauri dev (ไม่ใช่แค่เบราว์เซอร์)";
    }
    return err.message;
  }
  return "เกิดข้อผิดพลาด";
}
