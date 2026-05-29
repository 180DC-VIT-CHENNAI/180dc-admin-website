import React from 'react';

export const ScribbleArrow = ({ className = '', style = {} }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={`doodle-svg ${className}`} style={style} viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 40 Q30 10, 60 35 T100 20" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" />
    <path d="M90 10 L100 20 L95 30" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

export const ScribbleCircle = ({ className = '', style = {} }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={`doodle-svg ${className}`} style={style} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M50 10 C70 8, 88 25, 90 50 C92 75, 75 92, 50 90 C25 88, 8 70, 10 50 C12 25, 30 8, 50 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" />
  </svg>
);

export const ScribbleUnderline = ({ className = '', style = {} }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={`doodle-svg ${className}`} style={style} viewBox="0 0 200 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M5 15 Q50 5, 100 12 T195 8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" />
  </svg>
);

export const ScribbleStar = ({ className = '', style = {} }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={`doodle-svg ${className}`} style={style} viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M30 5 L35 22 L52 22 L38 32 L43 49 L30 39 L17 49 L22 32 L8 22 L25 22 Z" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

export const ScribbleZigzag = ({ className = '', style = {} }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={`doodle-svg ${className}`} style={style} viewBox="0 0 100 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M5 20 L20 5 L35 35 L50 5 L65 35 L80 5 L95 20" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

export const ScribbleSquiggle = ({ className = '', style = {} }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={`doodle-svg ${className}`} style={style} viewBox="0 0 100 30" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M5 15 Q15 5, 25 15 T45 15 T65 15 T85 15 T95 15" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" />
  </svg>
);

export const ScribbleBox = ({ className = '', style = {} }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={`doodle-svg ${className}`} style={style} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 15 L70 10 L75 65 L15 70 Z" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

export const ScribbleHeart = ({ className = '', style = {} }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={`doodle-svg ${className}`} style={style} viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M30 52 C30 52, 5 38, 5 22 C5 12, 12 5, 22 5 C27 5, 30 10, 30 10 C30 10, 33 5, 38 5 C48 5, 55 12, 55 22 C55 38, 30 52, 30 52 Z" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

export const DoodleDivider = ({ className = '', style = {} }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={`doodle-svg ${className}`} style={style} viewBox="0 0 200 30" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 15 Q50 5, 100 15 T190 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
    <circle cx="30" cy="15" r="3" fill="currentColor" />
    <circle cx="100" cy="15" r="3" fill="currentColor" />
    <circle cx="170" cy="15" r="3" fill="currentColor" />
  </svg>
);

export const FloatingNote = ({ text, className = '', style = {} }: { text: string; className?: string; style?: React.CSSProperties }) => (
  <div className={`floating-note ${className}`} style={style}>
    <span className="note-text">{text}</span>
  </div>
);

export const GrainOverlay = () => (
  <div className="grain-overlay" aria-hidden="true" />
);
