/* Student SVG Icon Set — 당근/인스타 style (soft, rounded) */
/* 24x24 viewBox, strokeWidth 1.5, round cap/join */

const I = ({ d, size = 20, color = 'currentColor', fill = 'none', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color}
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" focusable="false" {...props}>
    {typeof d === 'string' ? <path d={d} /> : d}
  </svg>
);

export const Trophy = (p) => <I {...p} d={<>
  <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
  <path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22" />
  <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22" />
  <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
</>} />;

export const Medal = (p) => <I {...p} d={<>
  <path d="M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15" />
  <path d="M11 12 5.12 2.2" /><path d="m13 12 5.88-9.8" />
  <circle cx="12" cy="17" r="5" />
  <path d="M12 13v4" /><path d="m14.5 15.5-5 3" /><path d="m9.5 15.5 5 3" />
</>} />;

export const Star = (p) => <I {...p} d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a.53.53 0 0 0 .398.29l5.164.753a.53.53 0 0 1 .294.904l-3.736 3.642a.53.53 0 0 0-.152.469l.882 5.14a.53.53 0 0 1-.77.56l-4.618-2.428a.53.53 0 0 0-.492 0L6.137 18.73a.53.53 0 0 1-.77-.56l.882-5.14a.53.53 0 0 0-.152-.47L2.361 8.922a.53.53 0 0 1 .294-.906l5.165-.752a.53.53 0 0 0 .398-.29l2.307-4.68z" />;

export const Fire = (p) => <I {...p} d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />;

export const Book = (p) => <I {...p} d={<>
  <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
</>} />;

export const Pencil = (p) => <I {...p} d={<>
  <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
  <path d="m15 5 4 4" />
</>} />;

export const Clock = (p) => <I {...p} d={<>
  <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
</>} />;

export const Timer = (p) => <I {...p} d={<>
  <line x1="10" y1="2" x2="14" y2="2" />
  <line x1="12" y1="14" x2="12" y2="10" />
  <circle cx="12" cy="14" r="8" />
</>} />;

export const Chart = (p) => <I {...p} d={<>
  <path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" />
</>} />;

export const BarChart = (p) => <I {...p} d={<>
  <line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" />
  <line x1="6" y1="20" x2="6" y2="16" />
</>} />;

export const Bell = (p) => <I {...p} d={<>
  <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
</>} />;

export const Message = (p) => <I {...p} d={<>
  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
</>} />;

export const Gift = (p) => <I {...p} d={<>
  <rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13" />
  <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
  <path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5" />
</>} />;

export const ShoppingBag = (p) => <I {...p} d={<>
  <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
  <path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" />
</>} />;

export const Sparkle = (p) => <I {...p} d={<>
  <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
  <path d="M5 3v4" /><path d="M19 17v4" /><path d="M3 5h4" /><path d="M17 19h4" />
</>} />;

export const CheckCircle = (p) => <I {...p} d={<>
  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="m9 11 3 3L22 4" />
</>} />;

export const XCircle = (p) => <I {...p} d={<>
  <circle cx="12" cy="12" r="10" /><path d="m15 9-6 6" /><path d="m9 9 6 6" />
</>} />;

export const AlertCircle = (p) => <I {...p} d={<>
  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" />
  <line x1="12" y1="16" x2="12.01" y2="16" />
</>} />;

export const ChevronRight = (p) => <I {...p} d="m9 18 6-6-6-6" />;

export const ArrowRight = (p) => <I {...p} d={<><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></>} />;

export const Refresh = (p) => <I {...p} d={<>
  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
  <path d="M21 3v5h-5" />
  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
  <path d="M8 16H3v5" />
</>} />;

export const Target = (p) => <I {...p} d={<>
  <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
</>} />;

export const Zap = (p) => <I {...p} d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />;

export const Heart = (p) => <I {...p} d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />;

export const Users = (p) => <I {...p} d={<>
  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
  <path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
</>} />;

export const Folder = (p) => <I {...p} d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />;

export const Camera = (p) => <I {...p} d={<>
  <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
  <circle cx="12" cy="13" r="3" />
</>} />;

export const Play = (p) => <I {...p} d={<>
  <circle cx="12" cy="12" r="10" /><polygon points="10 8 16 12 10 16 10 8" />
</>} />;

export const Download = (p) => <I {...p} d={<>
  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
  <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
</>} />;
