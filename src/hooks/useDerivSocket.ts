import { useState, useEffect } from 'react';
import { derivService } from '../services/derivSocket';

function getLastDigit(price: number | string, pipSize = 2) {
  const decimals = Number.isInteger(pipSize) && pipSize > 0 ? pipSize : 2;
  const formattedPrice = Number(price).toFixed(decimals);
  return Number(formattedPrice.charAt(formattedPrice.length - 1));
}

export function useDerivSocket(symbol: string) {
  const [currentTick, setCurrentTick] = useState<number | null>(null);
  const [marketStatus, setMarketStatus] = useState<string>('Connecting...');
  const [digitHistory, setDigitHistory] = useState<number[]>([]);

  useEffect(() => {
    let isMounted = true;
    let subscriptionId: string | null = null;

    derivService.onConnectionChange = (status) => {
      if (isMounted) setMarketStatus(status);
    };

    derivService.connect();

    // 1. Fetch history first so it populates instantly without waiting for live ticks
    setDigitHistory([]);
    derivService.send({
      ticks_history: symbol,
      adjust_start_time: 1,
      count: 100,
      end: 'latest',
      start: 1,
      style: 'ticks'
    }).then((res) => {
      if (isMounted && res && res.history && res.history.prices) {
        const historicalDigits = res.history.prices.map((price: number) => getLastDigit(price, res.history.pip_size || res.pip_size));
        setDigitHistory(historicalDigits);
      }
    }).catch((err) => {
      if (isMounted) setMarketStatus('Market unavailable');
      console.error("Failed to fetch tick history:", err);
    });

    // 2. Listen to incoming live ticks
    const unsubscribeMessage = derivService.subscribe('tick', (data: any) => {
      if (isMounted && data.tick) {
        if (data.subscription && data.tick.symbol === symbol) {
          subscriptionId = data.subscription.id;
        }

        if (data.tick.symbol === symbol) {
          const quote = Number(data.tick.quote);
          if (!isNaN(quote)) {
            setCurrentTick(quote);
            const lastDigit = getLastDigit(data.tick.quote, data.tick.pip_size);
            if (!isNaN(lastDigit)) {
              setDigitHistory((prev) => {
                // Keep the rolling history capped at the last 100 entries
                const updated = [...prev, lastDigit];
                return updated.slice(-100);
              });
            }
          }
        }
      }
    });

    // 3. Subscribe to the live tick stream
    derivService.send({
      ticks: symbol,
      subscribe: 1,
    }).then((res) => {
      if (isMounted && res && res.subscription) {
        subscriptionId = res.subscription.id;
      }
    }).catch((e) => {
      if (isMounted) setMarketStatus('Market unavailable');
      console.error('Failed to request live ticks:', e);
    });

    return () => {
      isMounted = false;
      unsubscribeMessage();

      if (subscriptionId) {
        derivService.send({ forget: subscriptionId }).catch(() => {});
      } else {
        derivService.send({ forget_all: 'ticks' }).catch(() => {});
      }
    };
  }, [symbol]);

  return { currentTick, marketStatus, digitHistory };
}