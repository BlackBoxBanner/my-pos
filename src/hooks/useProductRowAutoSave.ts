import { useCallback, useEffect, useRef, useState } from "react";
import {
  errorMessage,
  updateProduct,
  type Product,
  type UpdateProductInput,
} from "../lib/api";
import {
  applyUpdateInput,
  productToUpdateInput,
  updateInputsEqual,
} from "../lib/productUpdate";

const SAVE_DEBOUNCE_MS = 500;

export function useProductRowAutoSave(
  products: Product[],
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>,
  onSaved?: () => void,
) {
  const productsRef = useRef(products);
  productsRef.current = products;

  const committedRef = useRef<Map<number, UpdateProductInput>>(new Map());

  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const inflightRef = useRef<Set<number>>(new Set());

  const [savingIds, setSavingIds] = useState<Set<number>>(() => new Set());
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});

  const syncCommittedFromServer = useCallback((list: Product[]) => {
    const next = new Map<number, UpdateProductInput>();
    for (const p of list) {
      if (!inflightRef.current.has(p.id) && !timersRef.current.has(p.id)) {
        next.set(p.id, productToUpdateInput(p));
      } else {
        const prev = committedRef.current.get(p.id);
        if (prev) next.set(p.id, prev);
        else next.set(p.id, productToUpdateInput(p));
      }
    }
    committedRef.current = next;
  }, []);

  const setSaving = useCallback((id: number, saving: boolean) => {
    setSavingIds((prev) => {
      const next = new Set(prev);
      if (saving) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const revertRow = useCallback(
    (id: number) => {
      const committed = committedRef.current.get(id);
      if (!committed) return;
      setProducts((prev) =>
        prev.map((p) => (p.id === id ? applyUpdateInput(p, committed) : p)),
      );
    },
    [setProducts],
  );

  const flushSave = useCallback(
    async (id: number) => {
      const p = productsRef.current.find((row) => row.id === id);
      if (!p) return;

      const nextInput = productToUpdateInput(p);
      const committed = committedRef.current.get(id);
      if (committed && updateInputsEqual(committed, nextInput)) {
        return;
      }

      if (inflightRef.current.has(id)) return;
      inflightRef.current.add(id);
      setSaving(id, true);
      setRowErrors((prev) => {
        if (!prev[id]) return prev;
        const { [id]: _, ...rest } = prev;
        return rest;
      });

      try {
        const saved = await updateProduct(id, nextInput);
        committedRef.current.set(id, productToUpdateInput(saved));
        setProducts((prev) =>
          prev.map((row) => (row.id === id ? saved : row)),
        );
        onSaved?.();
      } catch (e) {
        revertRow(id);
        setRowErrors((prev) => ({ ...prev, [id]: errorMessage(e) }));
      } finally {
        inflightRef.current.delete(id);
        setSaving(id, false);
      }
    },
    [onSaved, revertRow, setProducts, setSaving],
  );

  const scheduleSave = useCallback(
    (id: number) => {
      const existing = timersRef.current.get(id);
      if (existing) clearTimeout(existing);
      timersRef.current.set(
        id,
        setTimeout(() => {
          timersRef.current.delete(id);
          void flushSave(id);
        }, SAVE_DEBOUNCE_MS),
      );
    },
    [flushSave],
  );

  const flushSaveNow = useCallback(
    (id: number) => {
      const existing = timersRef.current.get(id);
      if (existing) {
        clearTimeout(existing);
        timersRef.current.delete(id);
      }
      void flushSave(id);
    },
    [flushSave],
  );

  const patchProduct = useCallback(
    (id: number, patch: Partial<Product>) => {
      setProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      );
      scheduleSave(id);
    },
    [scheduleSave, setProducts],
  );

  useEffect(() => {
    return () => {
      for (const t of timersRef.current.values()) clearTimeout(t);
      timersRef.current.clear();
    };
  }, []);

  return {
    patchProduct,
    scheduleSave,
    flushSaveNow,
    syncCommittedFromServer,
    savingIds,
    rowErrors,
  };
}
