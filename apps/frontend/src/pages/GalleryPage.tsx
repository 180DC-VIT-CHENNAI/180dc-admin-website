import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import CosmicGallery from '../components/gallery/CosmicGallery';
import GalleryModal from '../components/gallery/GalleryModal';
import { GALLERY_ITEMS, CATEGORIES } from '../data/galleryData';
import type { GalleryCategory, GalleryItem } from '../data/galleryData';
import './GalleryPage.css';

export default function GalleryPage() {
  const { isDark } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState<GalleryCategory>('All');
  const [activeModalItem, setActiveModalItem] = useState<GalleryItem | null>(null);

  const filteredItems = GALLERY_ITEMS.filter(
    (item) => selectedCategory === 'All' || item.category === selectedCategory
  );

  const handleSelectItem = useCallback((item: GalleryItem) => {
    setActiveModalItem(item);
  }, []);

  const handleNextModalItem = useCallback(() => {
    if (!activeModalItem) return;
    const currentIndex = filteredItems.findIndex((i) => i.id === activeModalItem.id);
    if (currentIndex >= 0) {
      const nextIndex = (currentIndex + 1) % filteredItems.length;
      setActiveModalItem(filteredItems[nextIndex]);
    }
  }, [activeModalItem, filteredItems]);

  const handlePrevModalItem = useCallback(() => {
    if (!activeModalItem) return;
    const currentIndex = filteredItems.findIndex((i) => i.id === activeModalItem.id);
    if (currentIndex >= 0) {
      const prevIndex = (currentIndex - 1 + filteredItems.length) % filteredItems.length;
      setActiveModalItem(filteredItems[prevIndex]);
    }
  }, [activeModalItem, filteredItems]);

  return (
    <div className="gallery-page">
      {/* Back to Home Button */}
      <Link to="/" className="gallery-back-btn" aria-label="Back to home page">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="back-btn-icon"
        >
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        <span>Back to Home</span>
      </Link>

      {/* Hero Header with Carl Sagan Quote */}
      <header className="gallery-hero-header">
        <h1 className="gallery-cosmos-quote">
          The cosmos is within us. We are<br />
          made of star-stuff. We are a way for<br />
          the universe to know itself.
        </h1>

        {/* Category Pill Filters */}
        <div className="gallery-categories" role="tablist" aria-label="Gallery Categories">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              role="tab"
              aria-selected={selectedCategory === cat}
              className={`category-pill ${selectedCategory === cat ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
              <span className="category-count">
                {cat === 'All'
                  ? GALLERY_ITEMS.length
                  : GALLERY_ITEMS.filter((i) => i.category === cat).length}
              </span>
            </button>
          ))}
        </div>
      </header>

      {/* Main 3D Canvas Viewport */}
      <main className="gallery-scene-container" aria-label="3D Image Gallery">
        <CosmicGallery
          items={filteredItems}
          onSelectItem={handleSelectItem}
          selectedCategory={selectedCategory}
          isDark={isDark}
        />
      </main>

      {/* Lightbox / Details Modal */}
      <GalleryModal
        item={activeModalItem}
        onClose={() => setActiveModalItem(null)}
        onNext={handleNextModalItem}
        onPrev={handlePrevModalItem}
      />
    </div>
  );
}
