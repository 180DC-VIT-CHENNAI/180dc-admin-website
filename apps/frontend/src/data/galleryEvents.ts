import { GALLERY_ITEMS } from './galleryData';
import type { GalleryCategory, GalleryItem } from './galleryData';

/* One tile on the bento page = one event (all photos that share a year + title). */
export interface GalleryEvent {
  key: string;
  year: GalleryCategory;
  title: string;
  description: string;
  items: GalleryItem[];
}

function groupIntoEvents(items: GalleryItem[]): GalleryEvent[] {
  const map = new Map<string, GalleryEvent>();
  for (const item of items) {
    const key = `${item.category}::${item.title}`;
    const existing = map.get(key);
    if (existing) {
      existing.items.push(item);
    } else {
      map.set(key, {
        key,
        year: item.category,
        title: item.title,
        description: item.description,
        items: [item],
      });
    }
  }
  return Array.from(map.values());
}

export const GALLERY_EVENTS: GalleryEvent[] = groupIntoEvents(GALLERY_ITEMS);

/* ── Bento layout ─────────────────────────────────────────────────────────
   24-column grid. c = columns spanned, r = rows spanned.
   With 11+ events the first 7 tiles recreate the mockup (one tall tile in the
   middle of rows 1-2); the rest are laid out in full-width rows.
   Smaller years get a hero tile plus tiles that fill the remaining space,
   so there are never gaps. */
export interface BentoSpan {
  c: number;
  r: number;
}

const TOP_BLOCK: BentoSpan[] = [
  { c: 6, r: 1 },
  { c: 9, r: 2 },
  { c: 5, r: 1 },
  { c: 4, r: 1 },
  { c: 6, r: 1 },
  { c: 5, r: 1 },
  { c: 4, r: 1 },
];

const ROW_WIDTHS: Record<number, number[]> = {
  1: [24],
  2: [14, 10],
  3: [10, 7, 7],
  4: [9, 5, 5, 5],
};

export function getBentoSpans(n: number): BentoSpan[] {
  if (n <= 0) return [];
  if (n === 1) return [{ c: 24, r: 2 }];
  if (n === 2)
    return [
      { c: 12, r: 2 },
      { c: 12, r: 2 },
    ];

  if (n < 7) {
    const top = Math.ceil((n - 1) / 2);
    const bottom = Math.floor((n - 1) / 2);
    const spans: BentoSpan[] = [{ c: 12, r: 2 }];
    for (let i = 0; i < top; i++) spans.push({ c: 12 / top, r: 1 });
    for (let i = 0; i < bottom; i++) spans.push({ c: 12 / bottom, r: 1 });
    return spans;
  }

  const spans = [...TOP_BLOCK];
  const total = n - TOP_BLOCK.length;
  const rows = Math.ceil(total / 4);
  for (let row = 0; row < rows; row++) {
    const count = Math.floor(total / rows) + (row < total % rows ? 1 : 0);
    const widths = [...ROW_WIDTHS[count]];
    if (row % 2 === 1) widths.reverse();
    for (const c of widths) spans.push({ c, r: 1 });
  }
  return spans;
}

/* Puts the event with the most photos into the biggest slot. */
export function arrangeForBento(events: GalleryEvent[]): GalleryEvent[] {
  const n = events.length;
  const heroSlot = n >= 7 ? 1 : n >= 3 ? 0 : -1;
  if (heroSlot < 0) return events;
  let big = 0;
  events.forEach((e, i) => {
    if (e.items.length > events[big].items.length) big = i;
  });
  const rest = events.filter((_, i) => i !== big);
  rest.splice(heroSlot, 0, events[big]);
  return rest;
}
