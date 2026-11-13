import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { AppHeader, type AppTab } from "./components/AppHeader";
import { CheatsheetModal } from "./components/CheatsheetModal";
import { OnboardingWizard } from "./components/OnboardingWizard";
import { ShopProvider, useShop } from "./lib/shopContext";
import {
  readUiZoom,
  setUiZoom,
  stepUiZoom,
  UI_ZOOM_DEFAULT,
} from "./lib/uiZoom";

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
  const [zoom, setZoom] = useState(() => readUiZoom());
  const { report, lowStockCount, isTauri, settings, refreshStatus } = useShop();

  const changeZoom = useCallback((percent: number) => {
    setZoom(setUiZoom(percent));
  }, []);

  useEffect(() => {
    if (isTauri && settings && !settings.onboardingDone) {
      setShowOnboarding(true);
    }
  }, [isTauri, settings]);

  useEffect(() => {
    let wheelAcc = 0;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        setCheatsheet(true);
      }

      const mod = e.ctrlKey || e.metaKey;
      if (mod && !e.altKey) {
        if (e.key === "=" || e.key === "+") {
          e.preventDefault();
          setZoom((z) => stepUiZoom(1, z));
          return;
        }
        if (e.key === "-" || e.key === "_") {
          e.preventDefault();
          setZoom((z) => stepUiZoom(-1, z));
          return;
        }
        if (e.key === "0") {
          e.preventDefault();
          setZoom(setUiZoom(UI_ZOOM_DEFAULT));
          return;
        }
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

    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      // Trackpads fire many tiny deltas; accumulate before stepping 10%.
      wheelAcc += e.deltaY;
      if (Math.abs(wheelAcc) < 50) return;
      const dir = wheelAcc > 0 ? -1 : 1;
      wheelAcc = 0;
      setZoom((z) => stepUiZoom(dir, z));
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("wheel", onWheel);
    };
  }, []);

  const goAddProduct = useCallback((barcode: string) => {
    setPendingBarcode(barcode);
    setTab("products");
  }, []);

  const consumeBarcode = useCallback(() => {
    setPendingBarcode(null);
  }, []);

  return (
    <div className="app-zoom-shell flex min-h-0 flex-col bg-[var(--color-bg)]">
      <AppHeader
        tab={tab}
        onTabChange={(t) => {
          setTab(t);
          void refreshStatus();
        }}
        report={report}
        lowStockCount={lowStockCount}
        isTauri={isTauri}
        zoom={zoom}
        onZoomChange={changeZoom}
        onOpenCheatsheet={() => setCheatsheet(true)}
      />

      <main className="min-h-0 min-w-0 flex-1 overflow-hidden p-4 print:overflow-visible print:p-0">
        <Suspense
          fallback={
            <p className="p-6 text-center text-sm text-slate-500">กำลังโหลด…</p>
          }
        >
          <div className={tab === "sell" ? "h-full min-h-0" : "hidden"}>
            <SellPage
              onAddProduct={goAddProduct}
              active={tab === "sell"}
              onGoImport={() => setTab("products")}
            />
          </div>
          <div className={tab === "products" ? "h-full min-h-0" : "hidden"}>
            <ProductsPage
              initialBarcode={pendingBarcode}
              onConsumedBarcode={consumeBarcode}
            />
          </div>
          <div className={tab === "stock" ? "h-full min-h-0" : "hidden"}>
            <StockPage active={tab === "stock"} />
          </div>
          <div className={tab === "reports" ? "h-full min-h-0" : "hidden"}>
            <ReportsPage active={tab === "reports"} />
          </div>
          <div className={tab === "settings" ? "h-full min-h-0" : "hidden"}>
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
