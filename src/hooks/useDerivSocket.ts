import { useState, useEffect } from 'react';
import { derivService } from '../services/derivSocket';

export function getLastDigit(price: number | string, pipSize?: number) {
  const displayedDecimals = typeof price === 'string' && price.includes('.')
    ? price.split('.').at(-1)?.length ?? 0
    : 0;
  const decimals = Number.isInteger(pipSize) && pipSize !== undefined && pipSize >= 0
    ? pipSize
    : displayedDecimals || 2;
  const numericPrice = Number(price);
  if (!Number.isFinite(numericPrice)) return NaN;
  const formattedPrice = numericPrice.toFixed(decimals);
  return Number(formattedPrice.at(-1));
}

export function useDerivSocket(symbol: string) {
  const [currentTick, setCurrentTick] = useState<number | null>(null);
  const [marketStatus, setMarketStatus] = useState<string>('Connecting...');
  const [digitHistory, setDigitHistory] = useState<number[]>([]);
  const [priceHistory, setPriceHistory] = useState<number[]>([]);

  useEffect(() => {
    let isMounted = true;
    let subscriptionId: string | null = null;
    let connectionVersion = 0;
    let ticksDuringHistory: Array<{ price: number; digit: number }> = [];
    setDigitHistory([]);
    setPriceHistory([]);
    setCurrentTick(null);

    const unsubscribeMessage = derivService.subscribe('tick', (data: any) => {
      if (isMounted && data.tick) {
        if (data.subscription && data.tick.symbol === symbol) {
          subscriptionId = data.subscription.id;
        }

        if (data.tick.symbol === symbol) {
          const quote = Number(data.tick.quote);
          if (!isNaN(quote)) {
            setCurrentTick(quote);
            setPriceHistory((prev) => [...prev, quote].slice(-100));
            const lastDigit = getLastDigit(data.tick.quote, data.tick.pip_size);
            if (!isNaN(lastDigit)) {
              ticksDuringHistory.push({ price: quote, digit: lastDigit });
              ticksDuringHistory = ticksDuringHistory.slice(-100);
              setDigitHistory((prev) => {
                const updated = [...prev, lastDigit];
                return updated.slice(-100);
              });
            }
          }
        }
      }
    });

    derivService.onConnectionChange = (status) => {
      if (!isMounted) return;
      setMarketStatus(status);

      if (status !== 'Live') {
        subscriptionId = null;
        return;
      }

      const requestVersion = ++connectionVersion;
      ticksDuringHistory = [];
      subscriptionId = null;

      derivService.send({
        ticks_history: symbol,
        adjust_start_time: 1,
        count: 100,
        end: 'latest',
        start: 1,
        style: 'ticks'
      }).then((res) => {
        if (!isMounted || requestVersion !== connectionVersion || !res?.history?.prices) return;
        const prices = res.history.prices.map(Number).filter(Number.isFinite);
        const historicalDigits = prices.map((price: number) => getLastDigit(price, res.history.pip_size ?? res.pip_size));
        setDigitHistory([...historicalDigits, ...ticksDuringHistory.map(({ digit }) => digit)].slice(-100));
        setPriceHistory([...prices, ...ticksDuringHistory.map(({ price }) => price)].slice(-100));
      }).catch((err) => {
        if (isMounted && requestVersion === connectionVersion) setMarketStatus('Market unavailable');
        console.error('Failed to fetch tick history:', err);
      });

      derivService.send({ ticks: symbol, subscribe: 1 }).then((res) => {
        if (isMounted && requestVersion === connectionVersion && res?.subscription) {
          subscriptionId = res.subscription.id;
        }
      }).catch((err) => {
        if (isMounted && requestVersion === connectionVersion) setMarketStatus('Market unavailable');
        console.error('Failed to request live ticks:', err);
      });
    };

    derivService.connect();

    return () => {
      isMounted = false;
      connectionVersion += 1;
      unsubscribeMessage();
      derivService.onConnectionChange = undefined;

      if (subscriptionId) {
        derivService.send({ forget: subscriptionId }).catch(() => {});
      } else {
        derivService.send({ forget_all: 'ticks' }).catch(() => {});
      }
    };
  }, [symbol]);

  return { currentTick, marketStatus, digitHistory, priceHistory };
}