export type PaperWidth = '58mm' | '80mm';

export interface ReceiptLine {
  text: string;
  align?: 'left' | 'center' | 'right';
  bold?: boolean;
  /** معامل حجم: 1 عادي، 1.3 كبير شوي، 1.8 عنوان */
  size?: number;
}

const ESC = 0x1b;
const GS = 0x1d;
const BASE_FONT_PX = 22;
const PAD = 12;

export function paperDots(width: PaperWidth): number {
  // 58mm = حوالي 384 نقطة قابلة للطباعة، 80mm = حوالي 576 نقطة
  return width === '58mm' ? 384 : 576;
}

/** ارسم الأسطر على canvas. النص بيتقص إذا كان أطول من العرض، فصّر الأسطر الطويلة قبل ما تمرّرها. */
export async function renderReceiptCanvas(lines: ReceiptLine[], widthDots: number): Promise<HTMLCanvasElement> {
  // الخط مضمّن بالتطبيق (src/lib/fonts)، لازم نتأكد إنه محمّل قبل الرسم
  try {
    if (typeof document !== 'undefined' && document.fonts) {
      await document.fonts.load(`${BASE_FONT_PX}px Cairo`);
    }
  } catch {
    // تجاهل في بيئات لا تدعم Font Loading API
  }

  const heights = lines.map((l) => Math.round(BASE_FONT_PX * 1.4 * (l.size ?? 1)));
  const totalHeight = PAD * 2 + heights.reduce((a, b) => a + b, 0);

  const canvas = document.createElement('canvas');
  canvas.width = widthDots;
  canvas.height = totalHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('CANVAS_UNAVAILABLE');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, widthDots, totalHeight);
  ctx.fillStyle = '#000000';
  ctx.textBaseline = 'top';

  let y = PAD;
  lines.forEach((l, i) => {
    const px = Math.round(BASE_FONT_PX * (l.size ?? 1));
    ctx.font = `${l.bold ? 'bold ' : ''}${px}px Cairo, sans-serif`;
    if (l.align === 'center') {
      ctx.textAlign = 'center';
      ctx.fillText(l.text, widthDots / 2, y);
    } else if (l.align === 'right') {
      ctx.textAlign = 'right';
      ctx.fillText(l.text, widthDots - PAD, y);
    } else {
      ctx.textAlign = 'left';
      ctx.fillText(l.text, PAD, y);
    }
    y += heights[i];
  });

  return canvas;
}

/**
 * حوّل الـ canvas لأوامر GS v 0 (raster bit image) مقسّمة لأجزاء (bands).
 * كل band بيحتوي حتى 256 سطر، هيك الطلب بيكون صغير ومرن.
 */
export function canvasToRasterBands(canvas: HTMLCanvasElement, bandRows = 256): Uint8Array[] {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('CANVAS_UNAVAILABLE');

  const px = ctx.getImageData(0, 0, w, h).data;
  const bytesPerRow = Math.ceil(w / 8);
  const bands: Uint8Array[] = [];

  for (let y0 = 0; y0 < h; y0 += bandRows) {
    const rows = Math.min(bandRows, h - y0);
    const out = new Uint8Array(8 + bytesPerRow * rows);
    out.set(
      [GS, 0x76, 0x30, 0x00, bytesPerRow & 0xff, (bytesPerRow >> 8) & 0xff, rows & 0xff, (rows >> 8) & 0xff],
      0
    );

    for (let yy = 0; yy < rows; yy++) {
      const y = y0 + yy;
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const lum = px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114;
        if (lum < 140) {
          out[8 + yy * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7);
        }
      }
    }
    bands.push(out);
  }
  return bands;
}

/**
 * يرجع مصفوفة أجزاء جاهزة للإرسال بالترتيب:
 * ESC @ (reset) ثم الـ bands ثم feed ثم partial cut.
 */
export async function buildReceiptParts(lines: ReceiptLine[], paper: PaperWidth): Promise<Uint8Array[]> {
  const canvas = await renderReceiptCanvas(lines, paperDots(paper));
  const bands = canvasToRasterBands(canvas);
  return [
    new Uint8Array([ESC, 0x40]),           // ESC @  reset
    ...bands,
    new Uint8Array([ESC, 0x64, 0x04]),     // ESC d 4  feed 4 lines
    new Uint8Array([GS, 0x56, 0x42, 0x00]) // GS V 66 0  partial cut (إذا الطابعة ما عندها قاطع، بيتجاهل الأمر)
  ];
}

export function toBase64(bytes: Uint8Array): string {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}
