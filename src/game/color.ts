export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function hexToRgb(hex: string): Rgb {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const to = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** Perceived brightness, 0 (black) to 1 (white). */
export function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** Mixes toward white (amount > 0) or black (amount < 0). */
export function shade(hex: string, amount: number): string {
  const c = hexToRgb(hex);
  const t = amount > 0 ? 255 : 0;
  const p = Math.abs(amount);
  return rgbToHex({
    r: c.r + (t - c.r) * p,
    g: c.g + (t - c.g) * p,
    b: c.b + (t - c.b) * p,
  });
}

export function mix(a: string, b: string, t: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex({
    r: x.r + (y.r - x.r) * t,
    g: x.g + (y.g - x.g) * t,
    b: x.b + (y.b - x.b) * t,
  });
}

/** A marking colour that stays visible against `hex` when the player picks only one colour. */
export function autoContrast(hex: string): string {
  return luminance(hex) > 0.55 ? shade(hex, -0.42) : shade(hex, 0.45);
}

/** Black or white text, whichever is readable on `hex`. */
export function readableInk(hex: string): string {
  return luminance(hex) > 0.58 ? '#22262b' : '#ffffff';
}

export function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Rough perceptual distance between two hex colours, 0 (same) to ~765. */
export function colorDistance(a: string, b: string): number {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  // Weighted to match how the eye reads difference, green counting most.
  return Math.abs(x.r - y.r) * 0.9 + Math.abs(x.g - y.g) * 1.3 + Math.abs(x.b - y.b) * 0.8;
}
