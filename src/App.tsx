import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { AppHeader, type AppTab } from "./components/AppHeader";
import { CheatsheetModal } from "./components/CheatsheetModal";
import { OnboardingWizard } from "./components/OnboardingWizard";
import { ShopProvider, useShop } from "./lib/shopContext";

const SellPage = lazy(() =>
  import("./pages/SellPage").then((m) => ({ default: m.SellPage })),
);
const ProductsPage = lazy(() =>
  import("./pages/ProductsPage").then((m) => ({ default: m.ProductsPage })),
);
const StockPage = lazy(() =>
  import("./pages/StockPage").then((m) => ({ default: m.StockPage })),
);
const ReportsPage = lazy(() =>
  import("./pages/ReportsPage").then((m) => ({ default: m.ReportsPage })),
);
const SettingsPage = lazy(() =>
  import("./pages/SettingsPage").then((m) => ({ default: m.SettingsPage })),
);

function AppInner() {
  const [tab, setTab] = useState<AppTab>("sell");
  const [pendingBarcode, setPendingBarcode] = useState<string | null>(null);
  const [cheatsheet, setCheatsheet] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { report, lowStockCount, isTauri, settings, refreshStatus } = useShop();

  useEffect(() => {
    if (isTauri && settings && !settings.onboardingDone) {
      setShowOnboarding(true);
    }
  }, [isTauri, settings]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        setCheatsheet(true);
      }
      if (e.ctrlKey && !e.metaKey && !e.altKey) {
        const map: Record<string, AppTab> = {
          "1": "sell",
          "2": "products",
          "3": "stock",
          "4": "reports",
          "5": "settings",
        };
        const next = map[e.key];
        if (next) {
          e.preventDefault();
          setTab(next);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const goAddProduct = useCallback((barcode: string) => {
    setPendingBarcode(barcode);
    setTab("products");
  }, []);

  const consumeBarcode = useCallback(() => {
    setPendingBarcode(null);
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--color-bg)]">
      <AppHeader
        tab={tab}
        onTabChange={(t) => {
          setTab(t);
          void refreshStatus();
        }}
        report={report}
        lowStockCount={lowStockCount}
        isTauri={isTauri}
        onOpenCheatsheet={() => setCheatsheet(true)}
      />

      <main className="min-h-0 min-w-0 flex-1 p-4 print:p-0">
        <Suspense
          fallback={
            <p className="p-6 text-center text-sm text-slate-500">กำลังโหลด…</p>
          }
        >
        <div className={tab === "sell" ? "h-full" : "hidden"}>
          <SellPage
            onAddProduct={goAddProduct}
            active={tab === "sell"}
            onGoImport={() => setTab("products")}
          />
        </div>
        <div className={tab === "products" ? "h-full" : "hidden"}>
          <ProductsPage
            initialBarcode={pendingBarcode}
            onConsumedBarcode={consumeBarcode}
          />
        </div>
        <div className={tab === "stock" ? "h-full" : "hidden"}>
          <StockPage active={tab === "stock"} />
        </div>
        <div className={tab === "reports" ? "h-full" : "hidden"}>
          <ReportsPage active={tab === "reports"} />
        </div>
        <div className={tab === "settings" ? "h-full" : "hidden"}>
          <SettingsPage active={tab === "settings"} />
        </div>
        </Suspense>
      </main>

      {cheatsheet && <CheatsheetModal onClose={() => setCheatsheet(false)} />}
      {showOnboarding && (
        <OnboardingWizard
          onDone={() => setShowOnboarding(false)}
          onGoImport={() => {
            setShowOnboarding(false);
            setTab("products");
          }}
        />
      )}
    </div>
  );
}

function App() {
  return (
    <ShopProvider>
      <AppInner />
    </ShopProvider>
  );
}

export default App;
