import { useEffect, useState } from 'react';

type TimeInterval = { start: string; end: string };

const DISABLED_INTERVALS: TimeInterval[] = [
  { start: '14:18', end: '14:20' },
  { start: '23:45', end: '00:01' },
];

function isNowInInterval({ start, end }: TimeInterval): boolean {
  const now = new Date();

  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const [startH, startM] = start.split(':').map(Number);
  const [endH, endM] = end.split(':').map(Number);

  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes < endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  } else {
    // Intervalo pasa medianoche, ej: 23:45 a 00:01
    return nowMinutes >= startMinutes || nowMinutes < endMinutes;
  }
}

export function useIsButtonEnabled(intervals: TimeInterval[] = DISABLED_INTERVALS) {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    const update = () => {
      const shouldDisable = intervals.some(isNowInInterval);
      setEnabled(!shouldDisable);
    };

    update();
    const interval = setInterval(update, 15 * 1000); // chequea cada 15 seg

    return () => clearInterval(interval);
  }, [intervals]);

  return enabled;
}
