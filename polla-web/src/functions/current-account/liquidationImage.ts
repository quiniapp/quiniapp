import type { ImageLine } from '@/lib/liquidationImageLines';

/**
 * Dibuja una liquidación en un canvas y la devuelve como PNG, igual que
 * `makeTicketImage` de QuiniApp. El contenido es fijo (≤ 25 renglones): la
 * imagen es una sola, nunca se parte.
 */

// Medidas en px CSS; el canvas se dibuja a SCALE para que el texto salga nítido.
const SCALE = 2;
const WIDTH = 360;
const PAD_X = 18;
const PAD_Y = 20;
const DIVIDER_H = 14;

const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const MONO =
  'ui-monospace, Menlo, Consolas, "Roboto Mono", "Droid Sans Mono", "Courier New", monospace';

const STYLES = {
  title: { font: `bold 20px ${SANS}`, height: 28 },
  text: { font: `15px ${SANS}`, height: 22 },
  row: { font: `16px ${SANS}`, height: 26 },
  strongRow: { font: `bold 16px ${SANS}`, height: 26 },
} as const;

const lineHeight = (line: ImageLine) => {
  if (line.kind === 'divider') return DIVIDER_H;
  if (line.kind === 'row') return line.strong ? STYLES.strongRow.height : STYLES.row.height;
  return STYLES[line.kind].height;
};

export const renderLiquidationImage = (lines: ImageLine[]): Promise<Blob> => {
  const height = PAD_Y * 2 + lines.reduce((sum, line) => sum + lineHeight(line), 0);
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH * SCALE;
  canvas.height = height * SCALE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('No se pudo generar la imagen'));

  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, WIDTH, height);
  ctx.fillStyle = '#000';
  ctx.strokeStyle = '#000';
  ctx.textBaseline = 'middle';

  let y = PAD_Y;
  for (const line of lines) {
    const h = lineHeight(line);
    const mid = y + h / 2;
    if (line.kind === 'divider') {
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD_X, mid);
      ctx.lineTo(WIDTH - PAD_X, mid);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (line.kind === 'row') {
      ctx.font = line.strong ? STYLES.strongRow.font : STYLES.row.font;
      ctx.textAlign = 'left';
      ctx.fillText(line.label, PAD_X, mid);
      ctx.textAlign = 'right';
      ctx.font = line.strong ? STYLES.strongRow.font : `16px ${MONO}`;
      ctx.fillText(line.value, WIDTH - PAD_X, mid);
    } else {
      ctx.font = STYLES[line.kind].font;
      ctx.textAlign = 'center';
      ctx.fillText(line.text, WIDTH / 2, mid, WIDTH - PAD_X * 2);
    }
    y += h;
  }

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo generar la imagen'))),
      'image/png'
    )
  );
};
