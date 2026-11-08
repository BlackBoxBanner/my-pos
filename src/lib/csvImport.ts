import { parseBahtInput } from "./money";
import type { CreateProductInput } from "./api";

export type CsvParseResult = {
  rows: CreateProductInput[];
  errors: string[];
};

const TEMPLATE = `name,barcode,price_baht,stock_qty,low_stock_qty,active
น้ำดื่ม,885000100001,10.00,20,5,1
มาม่า,885000100002,7.50,50,10,1
`;

/** Download a sample CSV template for product import. */
export function downloadProductCsvTemplate() {
  const blob = new Blob([TEMPLATE], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "products-import-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      cells.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur.trim());
  return cells;
}

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/^\uFEFF/, "")
    .replace(/\s+/g, "_");
}

const HEADER_ALIASES: Record<string, string> = {
  name: "name",
  ชื่อ: "name",
  ชื่อสินค้า: "name",
  barcode: "barcode",
  บาร์โค้ด: "barcode",
  price_baht: "price_baht",
  price: "price_baht",
  ราคา: "price_baht",
  ราคาบาท: "price_baht",
  stock_qty: "stock_qty",
  stock: "stock_qty",
  สต็อก: "stock_qty",
  low_stock_qty: "low_stock_qty",
  low_stock: "low_stock_qty",
  เกณฑ์สต็อกต่ำ: "low_stock_qty",
  active: "active",
  สถานะ: "active",
  เปิดขาย: "active",
};

function parseActive(raw: string): boolean {
  const v = raw.trim().toLowerCase();
  if (!v) return true;
  if (["0", "false", "no", "n", "ปิด", "ปิดขาย"].includes(v)) return false;
  return true;
}

/** Parse product CSV text into CreateProductInput rows. */
export function parseProductCsv(text: string): CsvParseResult {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return { rows: [], errors: ["ไฟล์ว่างหรือมีแค่หัวตาราง"] };
  }

  const headers = splitCsvLine(lines[0]).map((h) => {
    const key = normalizeHeader(h);
    return HEADER_ALIASES[key] ?? key;
  });

  const nameIdx = headers.indexOf("name");
  const priceIdx = headers.indexOf("price_baht");
  if (nameIdx < 0 || priceIdx < 0) {
    return {
      rows: [],
      errors: ["หัวตารางต้องมีคอลัมน์ name และ price_baht (หรือ ชื่อ / ราคา)"],
    };
  }

  const barcodeIdx = headers.indexOf("barcode");
  const stockIdx = headers.indexOf("stock_qty");
  const lowIdx = headers.indexOf("low_stock_qty");
  const activeIdx = headers.indexOf("active");

  const rows: CreateProductInput[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rowNo = i + 1;
    const cells = splitCsvLine(lines[i]);
    const name = (cells[nameIdx] ?? "").trim();
    if (!name) {
      errors.push(`แถว ${rowNo}: ไม่มีชื่อสินค้า`);
      continue;
    }
    const priceSatang = parseBahtInput(cells[priceIdx] ?? "");
    if (priceSatang === null) {
      errors.push(`แถว ${rowNo}: ราคาไม่ถูกต้อง`);
      continue;
    }
    const stockRaw = stockIdx >= 0 ? (cells[stockIdx] ?? "0").trim() : "0";
    const stockQty = stockRaw === "" ? 0 : Number(stockRaw);
    if (!Number.isInteger(stockQty) || stockQty < 0) {
      errors.push(`แถว ${rowNo}: สต็อกต้องเป็นจำนวนเต็มไม่ติดลบ`);
      continue;
    }
    const lowRaw = lowIdx >= 0 ? (cells[lowIdx] ?? "5").trim() : "5";
    const lowStockQty = lowRaw === "" ? 5 : Number(lowRaw);
    if (!Number.isInteger(lowStockQty) || lowStockQty < 0) {
      errors.push(`แถว ${rowNo}: เกณฑ์สต็อกต่ำไม่ถูกต้อง`);
      continue;
    }
    const barcode =
      barcodeIdx >= 0 ? (cells[barcodeIdx] ?? "").trim() || null : null;
    const active = activeIdx >= 0 ? parseActive(cells[activeIdx] ?? "1") : true;

    rows.push({
      name,
      barcode,
      priceSatang,
      stockQty,
      lowStockQty,
      active,
    });
  }

  return { rows, errors };
}
