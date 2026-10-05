import { buildTicketContent, CHARS_PER_LINE, PrintableTicket, TicketContent } from './makeTicket';

// ── constants ─────────────────────────────────────────────────────────────────
// Medidas en px CSS; el canvas se dibuja a SCALE para que el texto salga nítido
const SCALE = 2;
const PAD_X = 18;
const PAD_Y = 20;
const DIVIDER_H = 14;
// WhatsApp (calidad estándar) achica las fotos a ~1600px del lado largo. Con hojas de
// hasta 1200px (2400 reales) el texto sigue legible después de esa reducción; los
// tickets más largos se parten en varias imágenes.
const MAX_PAGE_H = 1200;

const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const MONO =
  'ui-monospace, Menlo, Consolas, "Roboto Mono", "Droid Sans Mono", "Courier New", monospace';

const STYLES = {
  title: { font: `bold 20px ${SANS}`, height: 28, align: 'center', color: '#000' },
  mono: { font: `15px ${MONO}`, height: 22, align: 'left', color: '#000' },
  header: { font: `bold 13px ${SANS}`, height: 18, align: 'left', color: '#000' },
  total: { font: `bold 20px ${SANS}`, height: 34, align: 'center', color: '#000' },
  pageLabel: { font: `12px ${SANS}`, height: 18, align: 'center', color: '#555' },
} as const;

type Style = keyof typeof STYLES;
type Block = { kind: 'text'; text: string; style: Style } | { kind: 'divider' };

const blockHeight = (b: Block) => (b.kind === 'divider' ? DIVIDER_H : STYLES[b.style].height);
const text = (value: string, style: Style): Block => ({ kind: 'text', text: value, style });

function wrapText(ctx: CanvasRenderingContext2D, value: string, maxW: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of value.split(' ')) {
    const candidate = line ? `${line} ${word}` : word;
    if (!line || ctx.measureText(candidate).width <= maxW) {
      line = candidate;
      continue;
    }
    lines.push(line);
    line = word;
  }
  if (line) lines.push(line);
  return lines;
}

// ── layout ────────────────────────────────────────────────────────────────────
/** Reparte el ticket en hojas; las hojas siguientes repiten el número de ticket
 *  y el encabezado del grupo que quedó cortado. */
function paginate(content: TicketContent, wrapHeader: (value: string) => string[]): Block[][] {
  // se reserva siempre la línea "Hoja i de n" aunque después no haga falta
  const maxContentH = MAX_PAGE_H - PAD_Y * 2 - STYLES.pageLabel.height;
  const pages: Block[][] = [];
  let page: Block[] = [];
  let used = 0;

  const add = (b: Block) => {
    page.push(b);
    used += blockHeight(b);
  };
  const fits = (h: number) => used + h <= maxContentH;
  const newPage = () => {
    pages.push(page);
    page = [];
    used = 0;
    add(text(content.ticketLine, 'title'));
    add({ kind: 'divider' });
  };

  if (content.cashierLine) add(text(content.cashierLine, 'title'));
  add(text(content.ticketLine, 'title'));
  add(text(content.dateLine, 'mono'));
  add({ kind: 'divider' });

  for (const group of content.groups) {
    const header = wrapHeader(group.header).map((line) => text(line, 'header'));
    const headerH = header.length * STYLES.header.height;
    // el encabezado no queda solo al pie de una hoja
    if (!fits(headerH + STYLES.mono.height)) newPage();
    header.forEach(add);

    for (const row of group.rows) {
      if (!fits(STYLES.mono.height)) {
        newPage();
        header.forEach(add);
      }
      add(text(row, 'mono'));
    }

    if (fits(DIVIDER_H)) add({ kind: 'divider' });
  }

  if (!fits(STYLES.total.height)) newPage();
  add(text(content.totalLine, 'total'));
  pages.push(page);
  return pages;
}

// ── render ────────────────────────────────────────────────────────────────────
function renderPage(blocks: Block[], width: number, pageLabel?: string): HTMLCanvasElement {
  const contentH = blocks.reduce((h, b) => h + blockHeight(b), 0);
  const height = PAD_Y * 2 + contentH + (pageLabel ? STYLES.pageLabel.height : 0);

  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width * SCALE);
  canvas.height = Math.ceil(height * SCALE);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D no disponible');

  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);

  let y = PAD_Y;
  const drawText = (value: string, style: Style) => {
    const { font, height: lineH, align, color } = STYLES[style];
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(value, align === 'center' ? width / 2 : PAD_X, y + lineH / 2);
    y += lineH;
  };

  for (const b of blocks) {
    if (b.kind === 'text') {
      drawText(b.text, b.style);
      continue;
    }
    ctx.beginPath();
    ctx.moveTo(PAD_X, y + DIVIDER_H / 2);
    ctx.lineTo(width - PAD_X, y + DIVIDER_H / 2);
    ctx.stroke();
    y += DIVIDER_H;
  }
  if (pageLabel) drawText(pageLabel, 'pageLabel');

  return canvas;
}

const canvasToPng = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo generar la imagen'))),
      'image/png'
    )
  );

// ── image builder ─────────────────────────────────────────────────────────────
/** Mismo contenido que el PDF térmico, como PNG para compartir con vista previa.
 *  Devuelve una imagen por hoja (una sola salvo en tickets largos). */
export async function makeTicketImages(data: PrintableTicket): Promise<File[]> {
  const content = buildTicketContent(data);

  const measureCtx = document.createElement('canvas').getContext('2d');
  if (!measureCtx) throw new Error('Canvas 2D no disponible');
  // Ancho justo para las filas de 32 caracteres, igual que en la impresora
  measureCtx.font = STYLES.mono.font;
  const contentW = Math.ceil(measureCtx.measureText('0'.repeat(CHARS_PER_LINE)).width);
  const width = contentW + PAD_X * 2;

  measureCtx.font = STYLES.header.font;
  const pages = paginate(content, (value) => wrapText(measureCtx, value, contentW));

  const baseName = `ticket-${data.ticket.ticket_number}`;
  return Promise.all(
    pages.map(async (blocks, i) => {
      const multi = pages.length > 1;
      const canvas = renderPage(
        blocks,
        width,
        multi ? `Hoja ${i + 1} de ${pages.length}` : undefined
      );
      const blob = await canvasToPng(canvas);
      const fileName = multi ? `${baseName}-${i + 1}.png` : `${baseName}.png`;
      return new File([blob], fileName, { type: 'image/png' });
    })
  );
}
