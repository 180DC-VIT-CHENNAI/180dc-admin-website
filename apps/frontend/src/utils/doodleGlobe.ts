import * as d3 from 'd3-geo';

const OCEAN_COLOR = '#e8eef5';
const LAND_COLOR = '#f0ebe0';
const INDIA_FILL = 'rgba(141, 198, 63, 0.25)';
const PEN_COLOR = '#4a4a4a';
const PEN_LIGHT = '#888';
const INDIA_BORDER = '#8dc63f';

function wobble(path: string, amplitude = 0.3, frequency = 3): string {
  const points = parsePathToPoints(path);
  if (points.length < 3) return path;

  const wobbled = points.map((p, i) => {
    if (i === 0 || i === points.length - 1) return p;
    const angle = (i / points.length) * Math.PI * 2 * frequency;
    const wobX = Math.sin(angle) * amplitude * (Math.random() * 0.5 + 0.75);
    const wobY = Math.cos(angle * 1.3) * amplitude * (Math.random() * 0.5 + 0.75);
    return { x: p.x + wobX, y: p.y + wobY };
  });

  return pointsToPathString(wobbled);
}

function parsePathToPoints(path: string): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  const re = /([ML])\s*([\d.-]+)\s*([\d.-]+)/g;
  let match;
  while ((match = re.exec(path)) !== null) {
    points.push({ x: parseFloat(match[2]), y: parseFloat(match[3]) });
  }
  return points;
}

function pointsToPathString(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    d += `L${pts[i].x},${pts[i].y}`;
  }
  d += 'Z';
  return d;
}

function drawHandDrawnPath(
  ctx: CanvasRenderingContext2D,
  path: string,
  color: string,
  lineWidth: number,
  sketchy = true
) {
  if (sketchy) {
    for (let pass = 0; pass < 3; pass++) {
      ctx.beginPath();
      const wobbledPath = wobble(path, 0.4 + pass * 0.2, 2 + pass);
      const path2d = new Path2D(wobbledPath);
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth + (pass - 1) * 0.3;
      ctx.globalAlpha = 0.6;
      ctx.stroke(path2d);
    }
    ctx.globalAlpha = 1;
    ctx.beginPath();
    const mainPath = new Path2D(wobble(path, 0.2, 1.5));
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.globalAlpha = 1;
    ctx.stroke(mainPath);
  } else {
    ctx.beginPath();
    const path2d = new Path2D(path);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.stroke(path2d);
  }
}

function generatePaperTexture(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 12;
    data[i] += noise;
    data[i + 1] += noise;
    data[i + 2] += noise;
  }
  ctx.putImageData(imageData, 0, 0);
}

// fallow-ignore-next-line complexity
function drawGridLines(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.strokeStyle = PEN_LIGHT;
  ctx.lineWidth = 0.5;
  ctx.globalAlpha = 0.15;

  const latLines = 9;
  const lonLines = 13;

  for (let i = 0; i < latLines; i++) {
    const y = (i / (latLines - 1)) * height;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= width; x += 5) {
      ctx.lineTo(x, y + Math.sin(x * 0.05) * 0.5);
    }
    ctx.stroke();
  }

  for (let i = 0; i < lonLines; i++) {
    const x = (i / (lonLines - 1)) * width;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    for (let y = 0; y <= height; y += 5) {
      ctx.lineTo(x + Math.sin(y * 0.05) * 0.5, y);
    }
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
}

function drawOceanDoodles(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.strokeStyle = PEN_LIGHT;
  ctx.lineWidth = 0.8;
  ctx.globalAlpha = 0.12;

  const waves = 30;
  for (let i = 0; i < waves; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const len = 20 + Math.random() * 40;
    ctx.beginPath();
    for (let t = 0; t < 1; t += 0.05) {
      const px = x + t * len;
      const py = y + Math.sin(t * 8 + i) * 3;
      if (t === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  ctx.globalAlpha = 0.3;
  ctx.font = `${12 + Math.random() * 8}px "Segoe UI", sans-serif`;
  ctx.fillStyle = PEN_LIGHT;
  const labels = ['Atlantic Ocean', 'Pacific Ocean', 'Indian Ocean', 'Arctic Ocean'];
  const positions = [
    { x: width * 0.38, y: height * 0.55 },
    { x: width * 0.72, y: height * 0.5 },
    { x: width * 0.58, y: height * 0.65 },
    { x: width * 0.5, y: height * 0.08 },
  ];
  labels.forEach((label, i) => {
    const pos = positions[i];
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate((Math.random() - 0.5) * 0.1);
    ctx.globalAlpha = 0.15;
    ctx.fillText(label, 0, 0);
    ctx.restore();
  });
  ctx.globalAlpha = 1;
}

function drawCompass(ctx: CanvasRenderingContext2D, width: number, _height: number) { // eslint-disable-line @typescript-eslint/no-unused-vars
  const cx = width - 80;
  const cy = 80;
  const size = 35;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalAlpha = 0.25;

  ctx.beginPath();
  ctx.arc(0, 0, size + 5, 0, Math.PI * 2);
  ctx.strokeStyle = PEN_COLOR;
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 3]);
  ctx.stroke();
  ctx.setLineDash([]);

  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.sin(angle) * size, -Math.cos(angle) * size);
    ctx.strokeStyle = i % 2 === 0 ? PEN_COLOR : PEN_LIGHT;
    ctx.lineWidth = i < 4 ? 1.5 : 0.8;
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(-5, -size + 10);
  ctx.lineTo(5, -size + 10);
  ctx.closePath();
  ctx.fillStyle = '#8dc63f';
  ctx.fill();
  ctx.strokeStyle = PEN_COLOR;
  ctx.lineWidth = 0.8;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, size);
  ctx.lineTo(-4, size - 8);
  ctx.lineTo(4, size - 8);
  ctx.closePath();
  ctx.fillStyle = PEN_LIGHT;
  ctx.fill();
  ctx.strokeStyle = PEN_COLOR;
  ctx.lineWidth = 0.8;
  ctx.stroke();

  ctx.globalAlpha = 0.3;
  ctx.font = '8px sans-serif';
  ctx.fillStyle = PEN_COLOR;
  ctx.textAlign = 'center';
  ctx.fillText('N', 0, -size - 6);
  ctx.fillText('S', 0, size + 12);
  ctx.globalAlpha = 1;
  ctx.restore();
}

function getCountryPath(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  feature: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  projection: any,
  ctx: CanvasRenderingContext2D
): string | null {
  try {
    const pathGen = d3.geoPath(projection, ctx);
    const d = pathGen(feature);
    return d || null;
  } catch {
    return null;
  }
}

function drawSketchyCountry(
  ctx: CanvasRenderingContext2D,
  path: string,
  fillColor: string | null,
  strokeColor: string,
  isIndia: boolean
) {
  if (fillColor) {
    ctx.beginPath();
    const fillPath = new Path2D(path);
    ctx.fillStyle = fillColor;
    ctx.fill(fillPath);
  }

  if (isIndia) {
    drawHandDrawnPath(ctx, path, INDIA_BORDER, 2.5, true);
    ctx.beginPath();
    const glowPath = new Path2D(wobble(path, 0.8, 4));
    ctx.strokeStyle = 'rgba(141, 198, 63, 0.2)';
    ctx.lineWidth = 6;
    ctx.stroke(glowPath);
  } else {
    drawHandDrawnPath(ctx, path, strokeColor, 1, true);
  }
}

export function generateDoodleGlobeTexture(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  countriesGeoJSON: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  indiaGeoJSON: any,
  width = 2048,
  height = 1024
): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = OCEAN_COLOR;
  ctx.fillRect(0, 0, width, height);

  generatePaperTexture(ctx, width, height);
  drawGridLines(ctx, width, height);

  const projection = d3
    .geoEquirectangular()
    .fitSize([width, height], { type: 'Sphere' });

  if (countriesGeoJSON?.features) {
    for (const feature of countriesGeoJSON.features) {
      const isoA3 = feature.properties?.ISO_A3;
      if (isoA3 === 'IND') continue;

      const path = getCountryPath(feature, projection, ctx);
      if (!path) continue;

      drawSketchyCountry(ctx, path, LAND_COLOR, PEN_COLOR, false);
    }
  }

  if (indiaGeoJSON?.features) {
    for (const feature of indiaGeoJSON.features) {
      const path = getCountryPath(feature, projection, ctx);
      if (!path) continue;

      drawSketchyCountry(ctx, path, INDIA_FILL, INDIA_BORDER, true);
    }
  }

  drawOceanDoodles(ctx, width, height);
  drawCompass(ctx, width, height);

  ctx.fillStyle = 'rgba(245, 240, 232, 0.15)';
  ctx.fillRect(0, 0, width, height);

  return canvas.toDataURL('image/png');
}


