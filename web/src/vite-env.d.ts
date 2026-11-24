/// <reference types="vite/client" />

declare const __COMMIT_DATE__: string;

/** `ENABLE_SPEED_INSIGHTS=true` en el build. Definida en vite.config.ts. */
declare const __ENABLE_SPEED_INSIGHTS__: boolean;

/** `SPEED_INSIGHTS_SAMPLE_RATE` en el build, 0.01 si no está. Definida en vite.config.ts. */
declare const __SPEED_INSIGHTS_SAMPLE_RATE__: number;
