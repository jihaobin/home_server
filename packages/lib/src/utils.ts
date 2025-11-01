export function withOpacity(hexColor: string, opacity: number) {
	// 支持 #RRGGBB 或 #RGB
	let r = 0,
		g = 0,
		b = 0;
	if (hexColor.length === 7) {
		r = parseInt(hexColor.slice(1, 3), 16);
		g = parseInt(hexColor.slice(3, 5), 16);
		b = parseInt(hexColor.slice(5, 7), 16);
	} else if (hexColor.length === 4) {
		r = parseInt(hexColor[1] + hexColor[1], 16);
		g = parseInt(hexColor[2] + hexColor[2], 16);
		b = parseInt(hexColor[3] + hexColor[3], 16);
	}

	return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

// utils/color.ts
export function hslToRgba(hslColor: string, alpha = 1) {
  // 例: "hsl(20 14.0000% 96%)"
  const match = /hsl\((\d+\.?\d*)\s+(\d+\.?\d*)%\s+(\d+\.?\d*)%\)/.exec(hslColor);
  if (!match) return hslColor;

  const h = parseFloat(match[1]);
  const s = parseFloat(match[2]) / 100;
  const l = parseFloat(match[3]) / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;

  if (h >= 0 && h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  const R = Math.round((r + m) * 255);
  const G = Math.round((g + m) * 255);
  const B = Math.round((b + m) * 255);

  return `rgba(${R}, ${G}, ${B}, ${alpha})`;
}
