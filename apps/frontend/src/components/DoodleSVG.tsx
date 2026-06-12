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

export const ScribbleSquiggle = ({ className = '', style = {} }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={`doodle-svg ${className}`} style={style} viewBox="0 0 100 30" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M5 15 Q15 5, 25 15 T45 15 T65 15 T85 15 T95 15" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" />
  </svg>
);

export const GrainOverlay = () => (
  <div className="grain-overlay" aria-hidden="true" />
);
