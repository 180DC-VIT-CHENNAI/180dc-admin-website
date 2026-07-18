import * as d3 from 'd3-geo';

const OCEAN_COLOR = '#f8f9fa';
const LAND_COLOR = '#e8f5d0';
const INDIA_FILL = 'rgba(141, 198, 63, 0.15)';
const BORDER_COLOR = '#c8e896';
const INDIA_BORDER = '#8dc63f';
const GRID_COLOR = 'rgba(0, 0, 0, 0.04)';

function drawGridLines(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 0.5;

  const latLines = 9;
  const lonLines = 13;

  for (let i = 0; i < latLines; i++) {
    const y = (i / (latLines - 1)) * height;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  for (let i = 0; i < lonLines; i++) {
    const x = (i / (lonLines - 1)) * width;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
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

function drawCountry(
  ctx: CanvasRenderingContext2D,
  path: string,
  fillColor: string | null,
  strokeColor: string,
  lineWidth: number
) {
  if (fillColor) {
    ctx.beginPath();
    const fillPath = new Path2D(path);
    ctx.fillStyle = fillColor;
    ctx.fill(fillPath);
  }

  ctx.beginPath();
  const path2d = new Path2D(path);
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = lineWidth;
  ctx.stroke(path2d);
}

export function generateGlobeTexture(
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

      drawCountry(ctx, path, LAND_COLOR, BORDER_COLOR, 0.8);
    }
  }

  if (indiaGeoJSON?.features) {
    for (const feature of indiaGeoJSON.features) {
      const path = getCountryPath(feature, projection, ctx);
      if (!path) continue;

      drawCountry(ctx, path, INDIA_FILL, INDIA_BORDER, 2);
    }
  }

  return canvas.toDataURL('image/png');
}
