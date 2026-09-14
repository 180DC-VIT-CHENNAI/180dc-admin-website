import { useState, useEffect, useRef } from 'react';
import {
  facultyCoordinator,
  coreLeadership,
  departmentDirectors,
} from './orgChartData';
import type { OrgChartPerson } from './orgChartData';
import './OrgChart.css';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function MemberCard({
  person,
  size = 'normal',
}: {
  person: OrgChartPerson;
  size?: 'hero' | 'large' | 'normal';
}) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const showPhoto = person.photo && !photoFailed;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('visible');
          observer.unobserve(el);
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`member-card member-card--${size} member-card--animate`}
    >
      <div className={`member-card__avatar ${showPhoto ? '' : 'member-card__avatar--fallback'}`}>
        {showPhoto ? (
          <img
            src={person.photo}
            alt={person.name}
            className="member-card__img"
            onError={() => setPhotoFailed(true)}
          />
        ) : (
          <span className="member-card__initials">{getInitials(person.name)}</span>
        )}
      </div>
      <h3 className="member-card__name">{person.name}</h3>
      <p className="member-card__role">{person.role}</p>
      {person.linkedin && person.linkedin !== '#' && (
        <a
          href={person.linkedin}
          target="_blank"
          rel="noopener noreferrer"
          className="member-card__linkedin"
          aria-label={`${person.name} LinkedIn`}
        >
          <LinkedInIcon />
        </a>
      )}
    </div>
  );
}

function TierDivider({ label }: { label: string }) {
  return (
    <div className="tier-divider">
      <span className="tier-divider__line" />
      <span className="tier-divider__badge">{label}</span>
      <span className="tier-divider__line" />
    </div>
  );
}

export default function OrgChart() {
  return (
    <div className="leadership-grid">
      {/* Tier 1: Faculty Coordinator */}
      <TierDivider label="Faculty Coordinator" />
      <div className="leadership-row leadership-row--single">
        <MemberCard person={facultyCoordinator} size="hero" />
      </div>

      {/* Tier 2: Core Leadership */}
      <TierDivider label="Core Leadership" />
      <div className="leadership-row leadership-row--core">
        {coreLeadership.map((person, i) => (
          <MemberCard key={i} person={person} size="large" />
        ))}
      </div>

      {/* Tier 3: Department Directors */}
      <TierDivider label="Department Directors" />
      <div className="leadership-row leadership-row--directors">
        {departmentDirectors.map((person, i) => (
          <MemberCard key={i} person={person} />
        ))}
      </div>
    </div>
  );
}
