import type { Product, UpdateProductInput } from "./api";

export function productToUpdateInput(p: Product): UpdateProductInput {
  const barcode = p.barcode?.trim();
  return {
    name: p.name.trim(),
    barcode: barcode ? barcode : null,
    priceSatang: p.priceSatang,
    lowStockQty: p.lowStockQty,
    active: p.active,
  };
}

export function applyUpdateInput(p: Product, input: UpdateProductInput): Product {
  return {
    ...p,
    name: input.name,
    barcode: input.barcode,
    priceSatang: input.priceSatang,
    lowStockQty: input.lowStockQty,
    active: input.active,
  };
}

export function updateInputsEqual(
  a: UpdateProductInput,
  b: UpdateProductInput,
): boolean {
  return (
    a.name.trim() === b.name.trim() &&
    (a.barcode ?? "") === (b.barcode ?? "") &&
    a.priceSatang === b.priceSatang &&
    a.lowStockQty === b.lowStockQty &&
    a.active === b.active
  );
}
