import React, { useState } from 'react';
import { POLAROID_EVENTS } from './polaroidData';
import type { PolaroidEvent, Photo } from './polaroidData';

const VINE_H = { short: 22, mid: 38, long: 58 } as const;

function NavBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{ background: 'rgba(90,154,32,0.1)', border: '1px solid #5a9a20', color: '#3a7a10', width: 38, height: 38, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 22, lineHeight: 1, flexShrink: 0 }}>
      {children}
    </button>
  );
}

function PolaroidCard({ event, onClick }: { event: PolaroidEvent; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const vineH = VINE_H[event.vineLength];
  return (
    <div style={{ position: 'absolute', left: event.left, top: event.top, transform: `rotate(${event.rotation}deg)`, cursor: 'pointer', zIndex: 10 }} onClick={onClick}>
      <div
        style={{ background: '#fff', padding: '8px 8px 28px', width: 108, position: 'relative', boxShadow: hovered ? '7px 7px 20px rgba(0,0,0,0.3)' : '3px 3px 12px rgba(0,0,0,0.22)', transform: hovered ? 'translateY(-11px) scale(1.07)' : 'translateY(0) scale(1)', transition: 'transform .25s, box-shadow .25s' }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', width: 10, height: 10, background: '#4a8820', borderRadius: '50%', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}>
          <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: -vineH, width: 1.5, height: vineH, background: 'linear-gradient(to bottom, #5a9a20, #6ab830)', borderRadius: 1 }} />
        </div>
        <div style={{ width: '100%', height: 82, display: 'flex', alignItems: 'center', justifyContent: 'center', background: event.bg, overflow: 'hidden' }}>
          {event.photos[0]?.imageUrl
            ? <img src={event.photos[0].imageUrl} alt={event.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontSize: 28 }}>{event.emoji}</span>}
        </div>
        <p style={{ fontFamily: "'Caveat', cursive", fontSize: 11, textAlign: 'center', color: '#1a2a0a', margin: '5px 0 0', lineHeight: 1.3, whiteSpace: 'pre-line' }}>
          {event.cardCaption}
        </p>
      </div>
    </div>
  );
}

export function PolaroidGallery({ onClose }: { onClose?: () => void }) {
  const [activeEvent, setActiveEvent] = useState<PolaroidEvent | null>(null);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [flipping, setFlipping] = useState(false);
  const [view, setView] = useState<'wall' | 'detail'>('wall');

  const openEvent = (ev: PolaroidEvent) => { setActiveEvent(ev); setPhotoIdx(0); setView('detail'); };
  const closeDetail = () => { setView('wall'); setTimeout(() => setActiveEvent(null), 200); };
  const flipTo = (idx: number) => { setFlipping(true); setTimeout(() => { setPhotoIdx(idx); setFlipping(false); }, 180); };

  const currentPhoto: Photo | undefined = activeEvent?.photos[photoIdx];

  const lights: [number, number][] = [[14.5,9],[34.5,42],[52,12],[69.5,40],[87.5,15],[25,22],[45,28],[62,18],[78,32],[55,35]];
  const lightColors = ['#ffd700','#ffb300','#fff9c4','#8dc63f','#ffd54f','#ffcc02'];

  return (
    <div style={{ borderRadius: 16, overflow: 'hidden', maxWidth: 680, margin: '0 auto', border: '1px solid #c8e0a0', fontFamily: 'sans-serif' }}>

      {/* Header */}
      <div style={{ background: '#f8fcf2', padding: '14px 20px', borderBottom: '1px solid #d8eeaa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ margin: 0, fontSize: 10, color: '#5a9a20', letterSpacing: 2, fontFamily: "'Caveat', cursive", textTransform: 'uppercase' }}>180DC VIT Chennai</p>
          <p style={{ margin: '3px 0 0', fontSize: 22, color: '#1a3a08', fontFamily: "'Caveat', cursive", fontWeight: 700 }}>Our Activities</p>
        </div>
        {onClose && (
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: '50%', background: '#e4f5cc', border: 'none', cursor: 'pointer', fontSize: 14, color: '#5a9a20', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        )}
      </div>

      {/* Wall view */}
      {view === 'wall' && (
        <div style={{ position: 'relative', minHeight: 400, overflow: 'hidden' }}>
          <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} viewBox="0 0 680 400" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="pg-bk" width="84" height="42" patternUnits="userSpaceOnUse">
                <rect width="84" height="42" fill="#f4efe5"/>
                <rect x="2" y="2" width="78" height="17" fill="#ece6da" rx="2" stroke="#d8d0c4" strokeWidth="0.5"/>
                <rect x="44" y="23" width="78" height="17" fill="#ece6da" rx="2" stroke="#d8d0c4" strokeWidth="0.5"/>
                <rect x="-40" y="23" width="78" height="17" fill="#ece6da" rx="2" stroke="#d8d0c4" strokeWidth="0.5"/>
              </pattern>
              <filter id="pg-sketch" x="-2%" y="-2%" width="104%" height="104%">
                <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves={2} result="noise"/>
                <feDisplacementMap in="SourceGraphic" in2="noise" scale={0.6} xChannelSelector="R" yChannelSelector="G"/>
              </filter>
            </defs>
            <rect width="680" height="400" fill="url(#pg-bk)"/>
            <g fill="none" stroke="#5a9a20" strokeWidth="1.1" opacity="0.35" strokeLinecap="round">
              <path d="M 0,400 C 12,370 22,340 16,310 C 10,280 4,285 8,260 C 12,235 28,228 40,242"/>
              <path d="M 680,0 C 668,28 658,58 664,88 C 670,115 676,110 672,132 C 668,152 652,158 642,145"/>
            </g>
            <g filter="url(#pg-sketch)" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M 42,400 C 35,340 30,280 48,235 C 62,200 88,188 108,192" stroke="#3a7a10" strokeWidth="3.5"/>
              <path d="M 48,400 C 42,345 38,290 52,248 C 66,210 90,198 108,192" stroke="#5a9a20" strokeWidth="2" opacity="0.65"/>
              <path d="M 108,192 Q 145,95 255,52 Q 365,18 480,42 Q 555,58 598,72" stroke="#3a7a10" strokeWidth="2.4"/>
              <path d="M 108,192 Q 155,130 268,88 Q 380,55 492,78 Q 565,95 610,108" stroke="#4a8820" strokeWidth="2"/>
              <path d="M 108,192 Q 165,175 285,168 Q 405,162 515,178 Q 585,188 625,195" stroke="#3a7a10" strokeWidth="2.2"/>
              <path d="M 108,192 Q 140,240 255,268 Q 370,295 490,278 Q 565,265 615,252" stroke="#5a9a20" strokeWidth="1.8" opacity="0.85"/>
              <path d="M 108,192 Q 92,115 99,24" stroke="#3a7a10" strokeWidth="2.2"/>
              <path d="M 108,192 Q 178,218 242,126" stroke="#4a8820" strokeWidth="2"/>
              <path d="M 108,192 Q 252,82 402,18" stroke="#3a7a10" strokeWidth="2.3"/>
              <path d="M 108,192 Q 360,215 564,121" stroke="#4a8820" strokeWidth="2"/>
              <path d="M 175,125 C 168,118 160,116 154,122" stroke="#6ab830" strokeWidth="0.8"/>
              <path d="M 290,72 C 283,66 275,64 269,70" stroke="#6ab830" strokeWidth="0.8"/>
              <path d="M 410,95 C 403,89 395,87 389,93" stroke="#6ab830" strokeWidth="0.8"/>
              <path d="M 200,228 C 193,222 185,220 179,226" stroke="#6ab830" strokeWidth="0.8"/>
            </g>
            <circle cx="108" cy="192" r="7" fill="#4a8820" opacity="0.85"/>
            <circle cx="108" cy="192" r="4" fill="#6ab830"/>
            <g>
              <ellipse cx="130" cy="155" rx="6" ry="2.4" fill="#5a9a20" transform="rotate(-30,130,155)"/>
              <ellipse cx="268" cy="72" rx="6" ry="2.4" fill="#6ab830" transform="rotate(15,268,72)"/>
              <ellipse cx="340" cy="55" rx="5" ry="2" fill="#5a9a20" transform="rotate(-10,340,55)"/>
              <ellipse cx="510" cy="95" rx="5" ry="2" fill="#6ab830" transform="rotate(-15,510,95)"/>
              <ellipse cx="340" cy="210" rx="6" ry="2.4" fill="#6ab830" transform="rotate(-8,340,210)"/>
            </g>
          </svg>

          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 400, zIndex: 6, pointerEvents: 'none' }}>
            {lights.map(([x, y], i) => (
              <div key={i} style={{ position: 'absolute', left: `${x}%`, top: y, width: 7, height: 7, borderRadius: '50%', background: lightColors[i % lightColors.length], marginLeft: -3.5, opacity: 0.88, boxShadow: '0 0 4px rgba(255,200,0,0.35)' }}/>
            ))}
          </div>

          <div style={{ position: 'relative', height: 400, zIndex: 10 }}>
            {POLAROID_EVENTS.map((ev) => (
              <PolaroidCard key={ev.id} event={ev} onClick={() => openEvent(ev)} />
            ))}
          </div>

          <p style={{ textAlign: 'center', fontFamily: "'Caveat', cursive", fontSize: 15, color: 'rgba(58,122,16,0.55)', margin: '0 0 14px', position: 'relative', zIndex: 10 }}>
            tap a polaroid to explore 📸
          </p>
        </div>
      )}

      {/* Detail view */}
      {view === 'detail' && activeEvent && currentPhoto && (
        <div style={{ background: '#f8fcf2', padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <button onClick={closeDetail} style={{ background: 'rgba(90,154,32,0.1)', border: '1px solid #5a9a20', color: '#3a7a10', borderRadius: 999, padding: '6px 18px', fontFamily: "'Caveat', cursive", fontSize: 15, cursor: 'pointer', flexShrink: 0 }}>← back</button>
            <div>
              <p style={{ margin: 0, color: '#1a3a08', fontFamily: "'Caveat', cursive", fontSize: 20, fontWeight: 700 }}>{activeEvent.title}</p>
              <p style={{ margin: 0, color: '#7ab830', fontSize: 11 }}>photo {photoIdx + 1} of {activeEvent.photos.length}</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
            <NavBtn onClick={() => flipTo((photoIdx - 1 + activeEvent.photos.length) % activeEvent.photos.length)}>‹</NavBtn>
            <div style={{ position: 'relative', width: 256, height: 238, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ position: 'absolute', borderRadius: 3, width: 242, height: 224, background: '#fefce2', transform: 'rotate(7deg)', zIndex: 7, boxShadow: '3px 3px 10px rgba(0,0,0,0.12)' }}/>
              <div style={{ position: 'absolute', borderRadius: 3, width: 242, height: 224, background: '#f0f9dc', transform: 'rotate(3.5deg)', zIndex: 8, boxShadow: '3px 3px 10px rgba(0,0,0,0.12)' }}/>
              <div style={{ position: 'absolute', borderRadius: 3, width: 242, height: 224, background: '#fff', transform: flipping ? 'rotate(4deg) scale(0.95)' : 'rotate(0deg) scale(1)', transition: 'transform 0.22s', zIndex: 9, overflow: 'hidden', boxShadow: '3px 3px 10px rgba(0,0,0,0.12)' }}>
              <div style={{ width: '100%', height: currentPhoto.caption ? 165 : 196, display: 'flex', alignItems: 'center', justifyContent: 'center', background: currentPhoto.bg, overflow: 'hidden' }}>
                  {currentPhoto.imageUrl
                    ? <img src={currentPhoto.imageUrl} alt={currentPhoto.caption} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                    : null}
                </div>
                {currentPhoto.caption ? (
                  <div style={{ padding: '8px 12px' }}>
                    <p style={{ margin: 0, fontFamily: "'Caveat', cursive", fontSize: 15, color: '#1a2a08', lineHeight: 1.4, whiteSpace: 'pre-line' }}>{currentPhoto.caption}</p>
                  </div>
                )
                 : null}
            </div>
          </div>
            <NavBtn onClick={() => flipTo((photoIdx + 1) % activeEvent.photos.length)}>›</NavBtn>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 14 }}>
            {activeEvent.photos.map((_, i) => (
              <div key={i} onClick={() => flipTo(i)} style={{ width: 9, height: 9, borderRadius: '50%', background: i === photoIdx ? '#5a9a20' : '#b8d898', cursor: 'pointer', transition: 'background 0.2s' }}/>
            ))}
          </div>

          <p style={{ fontFamily: "'Caveat', cursive", fontSize: 14, color: '#5a8820', textAlign: 'center', margin: '12px 0 0', lineHeight: 1.6, padding: '0 20px' }}>
            {activeEvent.date} · {activeEvent.description}
          </p>
        </div>
      )}
    </div>
  );
}

export default PolaroidGallery;