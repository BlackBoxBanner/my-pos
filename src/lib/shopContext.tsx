import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  errorMessage,
  getShopSettings,
  getLowStockCount,
  getTodayReport,
  hasManagerPin,
  type ShopSettings,
  type TodayReport,
} from "../lib/api";

type ShopContextValue = {
  isTauri: boolean;
  report: TodayReport | null;
  hasPin: boolean;
  settings: ShopSettings;
  lowStockCount: number;
  refreshStatus: () => Promise<void>;
  refreshSettings: () => Promise<void>;
  setTabHint: (tab: string) => void;
};

const defaultSettings: ShopSettings = {
  shopName: "My POS",
  shopAddress: "",
  autoPrint: false,
  soundEnabled: false,
  onboardingDone: false,
};

const ShopContext = createContext<ShopContextValue | null>(null);

export function isTauriRuntime(): boolean {
  return (
    typeof window !== "undefined" &&
    // Tauri 2 injects __TAURI_INTERNALS__
    ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
  );
}

export function ShopProvider({ children }: { children: ReactNode }) {
  const [isTauri] = useState(() => isTauriRuntime());
  const [report, setReport] = useState<TodayReport | null>(null);
  const [hasPin, setHasPin] = useState(false);
  const [settings, setSettings] = useState<ShopSettings>(defaultSettings);
  const [lowStockCount, setLowStockCount] = useState(0);

  const refreshStatus = useCallback(async () => {
    if (!isTauriRuntime()) return;
    try {
      const [r, pin, lowStock] = await Promise.all([
        getTodayReport(),
        hasManagerPin(),
        getLowStockCount(),
      ]);
      setReport(r);
      setHasPin(pin);
      setLowStockCount(lowStock);
    } catch {
      /* ignore when not ready */
    }
  }, []);

  const refreshSettings = useCallback(async () => {
    if (!isTauriRuntime()) return;
    try {
      setSettings(await getShopSettings());
    } catch {
      /* keep defaults */
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
    void refreshSettings();
  }, [refreshStatus, refreshSettings]);

  const value = useMemo(
    () => ({
      isTauri,
      report,
      hasPin,
      settings,
      lowStockCount,
      refreshStatus,
      refreshSettings,
      setTabHint: () => undefined,
    }),
    [
      isTauri,
      report,
      hasPin,
      settings,
      lowStockCount,
      refreshStatus,
      refreshSettings,
    ],
  );

  return (
    <ShopContext.Provider value={value}>{children}</ShopContext.Provider>
  );
}

export function useShop() {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error("useShop must be used within ShopProvider");
  return ctx;
}

export function useShopOptional() {
  return useContext(ShopContext);
}

export function formatShopError(err: unknown): string {
  return errorMessage(err);
}
