import { useState } from 'react';
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

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(prev => !prev);
    onMobileMenuClick?.();
  };

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith('#')) {
      e.preventDefault();
      const target = document.querySelector(href);
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="pill-nav-container">
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

        <button
          className={`mobile-menu-button mobile-only${isMobileMenuOpen ? ' open' : ''}`}
          onClick={toggleMobileMenu}
          aria-label="Toggle menu"
          aria-expanded={isMobileMenuOpen}
        >
          <span className="hamburger-line" />
          <span className="hamburger-line" />
        </button>
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
