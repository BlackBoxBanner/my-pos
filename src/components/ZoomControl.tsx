import { UI_ZOOM_DEFAULT, UI_ZOOM_MAX, UI_ZOOM_MIN } from "../lib/uiZoom";
import { Button } from "./ui/Button";

type Props = {
  zoom: number;
  onZoomChange: (percent: number) => void;
};

export function ZoomControl({ zoom, onZoomChange }: Props) {
  return (
    <div
      className="flex items-center rounded-lg border border-slate-200 bg-slate-50"
      title="ซูมหน้าจอ"
    >
      <Button
        variant="ghost"
        size="sm"
        className="min-h-8 rounded-none rounded-l-lg px-2 py-1"
        onClick={() => onZoomChange(zoom - 10)}
        disabled={zoom <= UI_ZOOM_MIN}
        aria-label="ซูมออก"
        title="ซูมออก (Ctrl/Cmd −)"
      >
        −
      </Button>
      <button
        type="button"
        className="focus-ring min-w-[3.25rem] px-1 py-1 text-center text-xs font-medium tabular-nums text-slate-700 hover:bg-slate-100"
        onClick={() => onZoomChange(UI_ZOOM_DEFAULT)}
        title="รีเซ็ต 100%"
        aria-label={`ซูม ${zoom}% — คลิกรีเซ็ต`}
      >
        {zoom}%
      </button>
      <Button
        variant="ghost"
        size="sm"
        className="min-h-8 rounded-none rounded-r-lg px-2 py-1"
        onClick={() => onZoomChange(zoom + 10)}
        disabled={zoom >= UI_ZOOM_MAX}
        aria-label="ซูมเข้า"
        title="ซูมเข้า (Ctrl/Cmd +)"
      >
        +
      </Button>
    </div>
  );
}
