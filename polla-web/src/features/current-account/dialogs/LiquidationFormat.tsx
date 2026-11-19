/* eslint-disable react-refresh/only-export-components -- el selector, su hook y el texto del botón van juntos */
import { useCallback, useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  type LiquidationFormat,
  type PreparedLiquidation,
  deliverLiquidation,
} from '@/functions/current-account/liquidationDelivery';
import { ModeToggle } from './shared';

const FORMAT_OPTIONS = [
  ['pdf', 'PDF'],
  ['image', 'Imagen'],
] as const;

/** "Formato: PDF | Imagen" de las liquidaciones que se exportan. */
export const LiquidationFormatToggle = ({
  value,
  onChange,
  id = 'liquidation-format',
  disabled,
}: {
  value: LiquidationFormat;
  onChange: (format: LiquidationFormat) => void;
  id?: string;
  /** Mientras se preparan los archivos el formato no cambia. */
  disabled?: boolean;
}) => (
  <ModeToggle<LiquidationFormat>
    id={id}
    label="Formato"
    disabled={disabled}
    value={value}
    onChange={onChange}
    options={FORMAT_OPTIONS}
  />
);

/** "Exportar 3 PDFs" / "Exportar 1 imagen". */
export const exportActionLabel = (count: number, format: LiquidationFormat) =>
  format === 'image'
    ? `Exportar ${count} ${count === 1 ? 'imagen' : 'imágenes'}`
    : `Exportar ${count} ${count === 1 ? 'PDF' : 'PDFs'}`;

/**
 * Prepara y entrega las liquidaciones. En el celular, si el navegador pide un
 * toque nuevo para compartir las imágenes (`blocked`), lo ya preparado queda en
 * `pending` y `retry` lo comparte sin volver a prepararlo.
 */
export const useLiquidationDelivery = () => {
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PreparedLiquidation | null>(null);

  const deliver = useCallback(async (prepared: PreparedLiquidation) => {
    const result = await deliverLiquidation(prepared);
    if (result === 'done') {
      setPending(null);
      return true;
    }
    // Bloqueado o cancelado: queda para tocar Compartir de nuevo.
    setPending(prepared);
    if (result === 'blocked') toast('Tocá Compartir para enviar las imágenes');
    return false;
  }, []);

  /** Devuelve true si se entregó; false si no hay nada para exportar o quedó pendiente. */
  const run = useCallback(
    async (prepare: () => Promise<PreparedLiquidation | null>) => {
      setBusy(true);
      try {
        const prepared = await prepare();
        if (!prepared) return false;
        return await deliver(prepared);
      } finally {
        setBusy(false);
      }
    },
    [deliver]
  );

  const retry = useCallback(async () => {
    if (!pending) return false;
    setBusy(true);
    try {
      return await deliver(pending);
    } catch (error) {
      console.error(error);
      toast.error('No se pudieron compartir las liquidaciones');
      return false;
    } finally {
      setBusy(false);
    }
  }, [deliver, pending]);

  /** Descarta lo preparado (cambió el formato o lo que se exporta). */
  const reset = useCallback(() => setPending(null), []);

  return { busy, pending, run, retry, reset };
};
