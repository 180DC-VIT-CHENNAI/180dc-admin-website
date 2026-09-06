import { useEffect } from 'react';
import type { GalleryItem } from '../../data/galleryData';
import './GalleryModal.css';

interface GalleryModalProps {
  item: GalleryItem | null;
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
}

export default function GalleryModal({
  item,
  onClose,
  onNext,
  onPrev,
}: GalleryModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && onNext) onNext();
      if (e.key === 'ArrowLeft' && onPrev) onPrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onNext, onPrev]);

  if (!item) return null;

  return (
    <div className="gallery-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="gallery-modal-card" onClick={(e) => e.stopPropagation()}>
        <button
          className="gallery-modal-close"
          onClick={onClose}
          aria-label="Close modal"
        >
          ✕
        </button>

        <div className="gallery-modal-media-wrapper">
          <img src={item.image} alt={item.title} className="gallery-modal-img" />
          <div className="gallery-modal-badge">{item.category}</div>
        </div>

        <div className="gallery-modal-content">
          <div className="gallery-modal-header">
            <div>
              <span className="gallery-modal-date">{item.date}</span>
              <h2 className="gallery-modal-title">{item.title}</h2>
            </div>
          </div>
          <p className="gallery-modal-desc">{item.description}</p>

          <div className="gallery-modal-actions">
            {onPrev && (
              <button className="gallery-nav-btn" onClick={onPrev} aria-label="Previous item">
                ← Previous
              </button>
            )}
            {onNext && (
              <button className="gallery-nav-btn" onClick={onNext} aria-label="Next item">
                Next →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
