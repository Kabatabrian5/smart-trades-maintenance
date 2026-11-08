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

function formatPrice(price: number) {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(price);
}

export default function LivePriceChart({ symbol, prices, currentPrice, marketStatus }: LivePriceChartProps) {
  const chartPrices = prices.slice(-100);
  if (currentPrice !== null && chartPrices.at(-1) !== currentPrice) {
    chartPrices.push(currentPrice);
    if (chartPrices.length > 100) chartPrices.shift();
  }

  const firstPrice = chartPrices[0] ?? null;
  const lastPrice = chartPrices.at(-1) ?? null;
  const minimum = chartPrices.length ? Math.min(...chartPrices) : 0;
  const maximum = chartPrices.length ? Math.max(...chartPrices) : 1;
  const spread = maximum - minimum || Math.max(Math.abs(maximum) * 0.0001, 0.0001);
  const plotHeight = CHART_HEIGHT - VERTICAL_PADDING * 2;
  const plotWidth = CHART_WIDTH - HORIZONTAL_PADDING * 2;
  const points = chartPrices.map((price, index) => {
    const x = HORIZONTAL_PADDING + (chartPrices.length > 1 ? (index / (chartPrices.length - 1)) * plotWidth : plotWidth);
    const y = VERTICAL_PADDING + ((maximum - price) / spread) * plotHeight;
    return { x, y };
  });
  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const areaPath = points.length > 1
    ? `${linePath} L ${points.at(-1)?.x} ${CHART_HEIGHT - VERTICAL_PADDING} L ${points[0].x} ${CHART_HEIGHT - VERTICAL_PADDING} Z`
    : '';
  const changePercent = firstPrice && lastPrice !== null ? ((lastPrice - firstPrice) / firstPrice) * 100 : null;
  const latestPoint = points.at(-1);
  const hasLiveTicks = marketStatus === 'Live';

  return (
    <section aria-label={`${symbol} live price chart`} className="order-1 shrink-0 rounded-2xl border border-[#202a35] bg-[#111b22] p-3 sm:p-4 md:order-none">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">{symbol} · Price</p>
          <p className="mt-1 truncate font-mono text-lg font-bold text-white sm:text-xl">
            {lastPrice === null ? '--' : formatPrice(lastPrice)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={`rounded-full px-2 py-1 text-[8px] font-black uppercase tracking-[0.12em] ${hasLiveTicks ? 'bg-emerald-400/10 text-emerald-300' : 'bg-amber-400/10 text-amber-200'}`}>
            {hasLiveTicks ? 'Live' : marketStatus}
          </span>
          {changePercent !== null && (
            <span className={`font-mono text-[10px] font-bold ${changePercent >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
              {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}% <span className="font-sans font-medium text-slate-500">100 ticks</span>
            </span>
          )}
        </div>
      </div>

      <div className="relative mt-2 h-[140px] w-full overflow-hidden sm:h-[190px]">
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
          {latestPoint && <circle cx={latestPoint.x} cy={latestPoint.y} r="4" fill="#5eead4" stroke="#0f1720" strokeWidth="2" vectorEffect="non-scaling-stroke" />}
        </svg>
        {chartPrices.length < 2 && (
          <div className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-slate-500">
            {chartPrices.length === 1 ? 'Waiting for more ticks' : 'Waiting for price history'}
          </div>
        )}
      </div>
      <div className="flex justify-between px-1 text-[8px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        <span>Earlier</span>
        <span>Latest</span>
      </div>
    </section>
  );
}