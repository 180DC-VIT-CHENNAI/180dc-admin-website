import manifest from './galleryManifest.json';

export interface GalleryItem {
  id: string;
  title: string;
  category: GalleryCategory;
  date: string;
  description: string;
  image: string;
  accentColor?: string;
  featured?: boolean;
}

export type GalleryCategory = 'All' | '26-27' | '25-26' | '24-25';
export const CATEGORIES: readonly GalleryCategory[] = ['All', '26-27', '25-26', '24-25'] as const;

const ACCENT_COLORS = ['#8dc63f', '#75a633', '#5a8a1f', '#a8d96a'];

function buildGalleryItems(): GalleryItem[] {
  const items: GalleryItem[] = [];
  let idx = 0;

  for (const year of manifest.years) {
    for (const event of year.events) {
      for (const filename of event.images) {
        const accent = ACCENT_COLORS[idx % ACCENT_COLORS.length];
        items.push({
          id: `${year.id}-${event.id}-${filename}`,
          title: event.title,
          category: year.id as GalleryCategory,
          date: event.title,
          description: event.description,
          image: `${manifest.cdnBase}/${year.id}/${event.id}/${filename}`,
          accentColor: accent,
          featured: idx < 6,
        });
        idx++;
      }
    }
  }

  return items;
}

export const GALLERY_ITEMS: GalleryItem[] = buildGalleryItems();
