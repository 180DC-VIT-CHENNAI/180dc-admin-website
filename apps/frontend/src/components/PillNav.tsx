import { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useLenisScroll } from '../context/LenisContext';
import './PillNav.css';

interface PillNavItem {
  label: string;
  href: string;
  ariaLabel?: string;
}

interface PillNavProps {
  logo?: string;
  logoAlt?: string;
  items: PillNavItem[];
  activeHref?: string;
  className?: string;
  onMobileMenuClick?: () => void;
}

const PillNav = ({
  logo,
  logoAlt = 'Logo',
  items,
  activeHref,
  className = '',
  onMobileMenuClick,
}: PillNavProps) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { isDark, toggle } = useTheme();

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(prev => !prev);
    onMobileMenuClick?.();
  };

  const scrollTo = useLenisScroll();

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith('#')) {
      e.preventDefault();
      scrollTo(href);
    }
  };

  return (
    <div className={`pill-nav-container${isScrolled ? ' scrolled' : ''}`}>
      <nav className={`pill-nav ${className}`} aria-label="Primary">
        <div className="pill-nav-left">
          <a className="pill-logo" href={items?.[0]?.href || '#'} aria-label="Home">
            {logo ? (
              <img src={logo} alt={logoAlt} />
            ) : (
              <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#111' }}>180DC</span>
            )}
          </a>
          <span className="pill-brand-text">
            180 Degrees Consulting
            <span className="pill-brand-sub">VIT Chennai</span>
          </span>
        </div>

        <div className="pill-nav-right desktop-only">
          <ul className="pill-list" role="menubar">
            {items.map((item, i) => (
              <li key={item.href || `item-${i}`} role="none">
                <a
                  role="menuitem"
                  href={item.href}
                  className={`pill${activeHref === item.href ? ' is-active' : ''}`}
                  aria-label={item.ariaLabel || item.label}
                  onClick={(e) => handleNavClick(e, item.href)}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="pill-nav-actions">
          <button
            className="theme-toggle"
            onClick={toggle}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDark ? 'Light mode' : 'Dark mode'}
          >
            {isDark ? '\u2600' : '\u263E'}
          </button>

          <button
            className={`mobile-menu-button mobile-only${isMobileMenuOpen ? ' open' : ''}`}
            onClick={toggleMobileMenu}
            aria-label="Toggle menu"
            aria-expanded={isMobileMenuOpen}
          >
            <span className="hamburger-line" />
            <span className="hamburger-line" />
          </button>
        </div>
      </nav>

      {isMobileMenuOpen && (
        <div className="mobile-menu-popover mobile-only">
          <ul className="mobile-menu-list">
            {items.map((item, i) => (
              <li key={item.href || `mobile-item-${i}`}>
                <a
                  href={item.href}
                  className={`mobile-menu-link${activeHref === item.href ? ' is-active' : ''}`}
                  onClick={(e) => {
                    setIsMobileMenuOpen(false);
                    handleNavClick(e, item.href);
                  }}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default PillNav;
