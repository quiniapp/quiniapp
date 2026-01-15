'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale('es');

type ClockContext = {
  /** "HH:mm:ss" en 24hs */
  time: string;
  /** "martes, 12 de agosto de 2025" */
  date: string;
  /** now en la tz configurada */
  now: dayjs.Dayjs;
  /** zona horaria aplicada (por defecto America/Argentina/Buenos_Aires) */
  tz: string;
  /** true si el horario HH:mm es > ahora (mismo día), false si es <= */
  isScheduleAfter: (hhmm: string) => boolean;
  isLessThanTenMinutes: (hhmmss: string, windowMin?: number) => boolean; // <---
  isScheduleEnabled: (hhmmss: string, windowMin?: number) => boolean; // <---

  /** forzar resincronización manual */
  refresh: () => Promise<void>;
};

const ClockContext = createContext<ClockContext | null>(null);

type ClockProviderProps = {
  children: React.ReactNode;
  /** default: 'America/Argentina/Buenos_Aires' */
  tz?: string;
  /** cada cuánto resincronizar (ms). default: 30min */
  syncEveryMs?: number;
  /** API opcional. Por defecto usa worldtimeapi para la tz dada */
  timeApiUrl?: string;
};

export function ClockProvider({
  children,
  tz = 'America/Argentina/Buenos_Aires',
  syncEveryMs = 30 * 60 * 1000,
  timeApiUrl,
}: ClockProviderProps) {
  const intervalRef = useRef<number | null>(null);
  const acRef = useRef<AbortController | null>(null);
  const syncingRef = useRef(false);
  const tickId = useRef<number | null>(null);

  // offset contra el reloj del cliente, en ms. Se calcula con tiempo de red del servidor.
  const [offsetMs, setOffsetMs] = useState(0);

  // 'tick' para re-renderizar cada segundo
  const [tick, setTick] = useState(0);

  const computeNow = useCallback(() => dayjs.utc(Date.now() + offsetMs).tz(tz), [offsetMs, tz]);

  // Calcular now, time y date en un solo useMemo para reducir re-renders
  const { now, time, date } = useMemo(() => {
    const currentNow = dayjs.utc(Date.now() + offsetMs).tz(tz);
    return {
      now: currentNow,
      time: currentNow.format('HH:mm:ss'),
      date: currentNow.format('dddd, D [de] MMMM [de] YYYY'),
    };
  // El tick fuerza recálculo cada segundo
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offsetMs, tz, tick]);

  // Obtiene hora de red y devuelve offset (serverUTC - clientUTCmedio)
  const fetchNetworkOffset = useCallback(
    async (signal: AbortSignal): Promise<number | null> => {
      try {
        const url = timeApiUrl ?? `https://worldtimeapi.org/api/timezone/${encodeURIComponent(tz)}`;
        const t0 = Date.now();
        const res = await fetch(url, { cache: 'no-store', signal });
        const t1 = Date.now();
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as any;

        // Preferimos utc_datetime (worldtimeapi). Fallbacks comunes para otros endpoints.
        let serverEpochMs: number | null = null;
        if (data?.utc_datetime) serverEpochMs = dayjs(data.utc_datetime).valueOf();
        else if (data?.datetime) serverEpochMs = dayjs(data.datetime).valueOf();
        else if (data?.dateTime) serverEpochMs = dayjs(data.dateTime).valueOf();
        else if (data?.currentDateTime) serverEpochMs = dayjs(data.currentDateTime).valueOf();

        if (!serverEpochMs || Number.isNaN(serverEpochMs)) {
          throw new Error('No se encontró un datetime válido en la respuesta');
        }

        const clientMid = (t0 + t1) / 2;
        return serverEpochMs - clientMid; // corrección tipo NTP
      } catch (err) {
        console.warn('Clock sync failed:', err);
        return null;
      }
    },
    [timeApiUrl, tz]
  );

  const sync = useCallback(async () => {
    if (syncingRef.current) return; // evita solapados
    syncingRef.current = true;

    // aborta fetch previo si hubiera
    acRef.current?.abort();
    const ac = new AbortController();
    acRef.current = ac;

    try {
      const ms = await fetchNetworkOffset(ac.signal);
      if (typeof ms === 'number') setOffsetMs(ms);
    } finally {
      if (acRef.current === ac) acRef.current = null;
      syncingRef.current = false;
    }
  }, [fetchNetworkOffset]);

  // tick de 1s
  useEffect(() => {
    tickId.current = window.setInterval(() => {
      setTick((t) => (t + 1) % 60_000);
    }, 1000);
    return () => {
      if (tickId.current) clearInterval(tickId.current);
    };
  }, []);

  // Intervalo estricto (solo 30 min). Sin eventos del browser.
  useEffect(() => {
    // limpia si existiera (StrictMode / cambios de props)
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // crea el intervalo ya (no esperamos al primer sync)
    intervalRef.current = window.setInterval(() => {
      void sync();
    }, syncEveryMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      acRef.current?.abort();
    };
  }, [sync, syncEveryMs]);

  // true si HH:mm es estrictamente mayor que ahora (mismo día)
  const isScheduleAfter = useCallback(
    (hhmm: string) => {
      const [hs, ms] = hhmm.split(':');
      const h = Number(hs);
      const m = Number(ms);
      if (Number.isNaN(h) || Number.isNaN(m)) return false;
      const target = computeNow().hour(h).minute(m).second(0).millisecond(0);
      return target.isAfter(computeNow());
    },
    [computeNow]
  );

  // dentro de ClockProvider, arriba de `const value = useMemo(...`
  const toTodayAt = useCallback(
    (hhmmss: string) => {
      const [hh, mm, ss = '0'] = (hhmmss ?? '').trim().split(':');
      const h = Number(hh),
        m = Number(mm),
        s = Number(ss);
      if ([h, m, s].some(Number.isNaN)) return null;

      // usar misma fecha/tz que now (via computeNow)
      return computeNow().hour(h).minute(m).second(s).millisecond(0);
    },
    [computeNow]
  );

  /** true si falta <= windowMin minutos para ese horario de hoy (y todavía no pasó) */
  const isLessThanTenMinutes = useCallback(
    (hhmmss: string, windowMin = 10) => {
      const target = toTodayAt(hhmmss);
      if (!target) return false;
      const diffSec = target.diff(computeNow(), 'second');
      return diffSec > 0 && diffSec <= windowMin * 60;
    },
    [toTodayAt, computeNow]
  );

  /** Tu regla original: habilitado si falta > windowMin minutos; deshabilitado cuando <= windowMin */
  const isScheduleEnabled = useCallback(
    (hhmmss: string, windowMin = 10) => {
      const target = toTodayAt(hhmmss);
      if (!target) return false; // string inválido
      const diffSec = target.diff(computeNow(), 'second');
      return diffSec > windowMin * 60; // true: aún falta más de 10min
    },
    [toTodayAt, computeNow]
  );

  const value = useMemo<ClockContext>(
    () => ({
      time,
      date,
      now,
      tz,
      isScheduleAfter,
      isLessThanTenMinutes, // <---
      isScheduleEnabled, // <---
      refresh: sync,
    }),
    [time, date, now, tz, isScheduleAfter, isLessThanTenMinutes, isScheduleEnabled, sync]
  );

  return <ClockContext.Provider value={value}>{children}</ClockContext.Provider>;
}

export function useClock() {
  const ctx = useContext(ClockContext);

  // Fallback seguro durante lazy loading o transiciones
  if (!ctx) {
    const now = dayjs();
    return {
      time: now.format('HH:mm:ss'),
      date: now.format('dddd, D [de] MMMM [de] YYYY'),
      now,
      tz: 'America/Argentina/Buenos_Aires',
      isScheduleAfter: () => false,
      isLessThanTenMinutes: () => false,
      isScheduleEnabled: () => false,
      refresh: async () => {},
    };
  }

  return ctx;
}
