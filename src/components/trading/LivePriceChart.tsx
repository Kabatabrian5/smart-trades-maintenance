import { useState } from 'react';

interface LivePriceChartProps {
  symbol: string;
  prices: number[];
  currentPrice: number | null;
  marketStatus: string;
}

const CHART_WIDTH = 800;
const CHART_HEIGHT = 190;
const HORIZONTAL_PADDING = 4;
const VERTICAL_PADDING = 12;
const ZOOM_TICK_COUNTS = [100, 50, 20];

function formatPrice(price: number) {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(price);
}

export default function LivePriceChart({ symbol, prices, currentPrice, marketStatus }: LivePriceChartProps) {
  const [zoomIndex, setZoomIndex] = useState(0);
  const allChartPrices = prices.slice(-100);
  if (currentPrice !== null && allChartPrices.at(-1) !== currentPrice) {
    allChartPrices.push(currentPrice);
    if (allChartPrices.length > 100) allChartPrices.shift();
  }
  const chartPrices = allChartPrices.slice(-ZOOM_TICK_COUNTS[zoomIndex]);

  const firstPrice = chartPrices[0] ?? null;
  const lastPrice = chartPrices.at(-1) ?? null;
  const minimum = chartPrices.length ? Math.min(...chartPrices) : 0;
  const maximum = chartPrices.length ? Math.max(...chartPrices) : 1;
  const spread = maximum - minimum || Math.max(Math.abs(maximum) * 0.0001, 0.0001);
  const plotHeight = CHART_HEIGHT - VERTICAL_PADDING * 2;
  const plotWidth = CHART_WIDTH - HORIZONTAL_PADDING * 2;
  const priceAxisLabels = chartPrices.length
    ? Array.from({ length: 4 }, (_, index) => formatPrice(maximum - (spread * index) / 3))
    : [];
  const points = chartPrices.map((price, index) => {
    const x = HORIZONTAL_PADDING + (chartPrices.length > 1 ? (index / (chartPrices.length - 1)) * plotWidth : plotWidth);
    const y = VERTICAL_PADDING + ((maximum - price) / spread) * plotHeight;
    return { x, y };
  });
  const highPoint = points[chartPrices.indexOf(maximum)];
  const lowPoint = points[chartPrices.indexOf(minimum)];
  const hasPriceRange = chartPrices.length > 1 && maximum !== minimum;
  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const areaPath = points.length > 1
    ? `${linePath} L ${points.at(-1)?.x} ${CHART_HEIGHT - VERTICAL_PADDING} L ${points[0].x} ${CHART_HEIGHT - VERTICAL_PADDING} Z`
    : '';
  const changePercent = firstPrice && lastPrice !== null ? ((lastPrice - firstPrice) / firstPrice) * 100 : null;
  const latestPoint = points.at(-1);
  const hasLiveTicks = marketStatus === 'Live';
  const canZoomIn = zoomIndex < ZOOM_TICK_COUNTS.length - 1 && allChartPrices.length > ZOOM_TICK_COUNTS[zoomIndex + 1];
  const canZoomOut = zoomIndex > 0;

  return (
    <section aria-label={`${symbol} live price chart`} className="live-price-chart order-1 shrink-0 rounded-2xl border border-[#202a35] bg-[#111b22] p-3 sm:p-4 md:order-none">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">{symbol} · Price</p>
          <p className="mt-1 truncate font-mono text-lg font-bold text-white sm:text-xl">
            {lastPrice === null ? '--' : formatPrice(lastPrice)}
          </p>
          {hasPriceRange && (
            <div className="mt-1 flex gap-2 font-mono text-[8px] font-bold sm:text-[9px]">
              <span className="text-emerald-300">HIGH {formatPrice(maximum)}</span>
              <span className="text-rose-300">LOW {formatPrice(minimum)}</span>
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <div role="group" aria-label="Chart zoom controls" className="flex overflow-hidden rounded-md border border-[#2b3945]">
              <button type="button" title="Zoom in" aria-label="Zoom in chart" disabled={!canZoomIn} onClick={() => setZoomIndex((index) => Math.min(index + 1, ZOOM_TICK_COUNTS.length - 1))} className="h-7 w-7 text-base font-semibold text-slate-200 transition hover:bg-[#24343e] disabled:cursor-not-allowed disabled:opacity-40">+</button>
              <span className="w-px bg-[#2b3945]" />
              <button type="button" title="Zoom out" aria-label="Zoom out chart" disabled={!canZoomOut} onClick={() => setZoomIndex((index) => Math.max(index - 1, 0))} className="h-7 w-7 text-base font-semibold text-slate-200 transition hover:bg-[#24343e] disabled:cursor-not-allowed disabled:opacity-40">−</button>
            </div>
            <span className={`rounded-full px-2 py-1 text-[8px] font-black uppercase tracking-[0.12em] ${hasLiveTicks ? 'bg-emerald-400/10 text-emerald-300' : 'bg-amber-400/10 text-amber-200'}`}>
              {hasLiveTicks ? 'Live' : marketStatus}
            </span>
          </div>
          {changePercent !== null && (
            <span className={`font-mono text-[10px] font-bold ${changePercent >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
              {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}% <span className="font-sans font-medium text-slate-500">{chartPrices.length} ticks</span>
            </span>
          )}
        </div>
      </div>

      <div className="relative mt-2 flex h-[140px] w-full gap-2 sm:h-[190px]">
        <div className="relative min-w-0 flex-1 overflow-hidden">
          <svg className="h-full w-full" viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} preserveAspectRatio="none" role="img" aria-label={`${symbol} price movement over the last ${chartPrices.length} ticks`}>
          <defs>
            <linearGradient id="live-price-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.24" />
              <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3].map((line) => {
            const y = VERTICAL_PADDING + (line / 3) * plotHeight;
            return <line key={`horizontal-${line}`} x1={HORIZONTAL_PADDING} x2={CHART_WIDTH - HORIZONTAL_PADDING} y1={y} y2={y} stroke="#263640" strokeWidth="1" strokeDasharray="4 7" />;
          })}
          {[0, 1, 2, 3, 4].map((line) => {
            const x = HORIZONTAL_PADDING + (line / 4) * plotWidth;
            return <line key={`vertical-${line}`} x1={x} x2={x} y1={VERTICAL_PADDING} y2={CHART_HEIGHT - VERTICAL_PADDING} stroke="#263640" strokeWidth="1" strokeDasharray="4 7" />;
          })}
          {areaPath && <path d={areaPath} fill="url(#live-price-area)" />}
          {linePath && <path d={linePath} fill="none" stroke="#2dd4bf" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />}
          {hasPriceRange && highPoint && <circle cx={highPoint.x} cy={highPoint.y} r="4" fill="#4ade80" stroke="#0f1720" strokeWidth="2" vectorEffect="non-scaling-stroke" />}
          {hasPriceRange && lowPoint && <circle cx={lowPoint.x} cy={lowPoint.y} r="4" fill="#fb7185" stroke="#0f1720" strokeWidth="2" vectorEffect="non-scaling-stroke" />}
          {latestPoint && <circle cx={latestPoint.x} cy={latestPoint.y} r="4" fill="#5eead4" stroke="#0f1720" strokeWidth="2" vectorEffect="non-scaling-stroke" />}
          </svg>
          {chartPrices.length < 2 && (
            <div className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-slate-500">
              {chartPrices.length === 1 ? 'Waiting for more ticks' : 'Waiting for price history'}
            </div>
          )}
        </div>
        <div aria-label="Price scale" className="flex w-[4.25rem] shrink-0 flex-col justify-between py-2 text-right font-mono text-[9px] leading-none text-slate-400">
          {priceAxisLabels.map((label, index) => <span key={`${index}-${label}`}>{label}</span>)}
        </div>
      </div>
      <div className="flex justify-between px-1 text-[8px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        <span>Earlier</span>
        <span>Latest</span>
      </div>
    </section>
  );
}