export interface Photo {
  caption: string;
  bg: string;
  imageUrl?: string;
}

export interface PolaroidEvent {
  id: string;
  title: string;
  cardCaption: string;
  date: string;
  description: string;
  bg: string;
  rotation: number;
  vineLength: 'short' | 'mid' | 'long';
  left: number;
  top: number;
  emoji?: string;
  photos: Photo[];
}

export const POLAROID_EVENTS: PolaroidEvent[] = [
  {
    id: 'our-team',
    title: 'Our Team',
    cardCaption: 'Our Team\n2025',
    date: '2025',
    description: 'Meet the passionate, driven team behind 180 Degrees Consulting VIT Chennai — analysts, associates, and leaders creating real-world impact.',
    bg: '#d8eec0',
    rotation: -7,
    vineLength: 'short',
    left: 45,
    top: 38,
    photos: [
      { caption: '180DC VIT Chennai', bg: '#d8eec0', imageUrl: '/images/team-1.jpeg' },
      { caption: '', bg: '#cce4b4', imageUrl: '/images/team-2.jpeg' },
      { caption: '', bg: '#d8eec0', imageUrl: '/images/team-3.jpeg' },
      { caption: '', bg: '#cce4b4', imageUrl: '/images/team-4.jpeg' },
      { caption: '', bg: '#d8eec0', imageUrl: '/images/team-4-meet.jpeg' },
      { caption: '', bg: '#cce4b4', imageUrl: '/images/team-5.jpeg' },
      { caption: '', bg: '#d8eec0', imageUrl: '/images/team-5-meet.jpg' },
      { caption: '', bg: '#cce4b4', imageUrl: '/images/team-6.jpeg' },
      { caption: '', bg: '#d8eec0', imageUrl: '/images/team-6-meet.jpg' },
      { caption: 'With our faculty advisor', bg: '#cce4b4', imageUrl: '/images/faculty.jpeg' },
    ],
  },

  {
    id: 'club-expo-2025',
    title: 'Club Expo 2025',
    cardCaption: 'Club Expo\n2025',
    date: '2025',
    description: 'Club Expo 2025 saw 180DC VIT Chennai present its mission and welcome the next cohort of consultants.',
    bg: '#cce4b4',
    rotation: 6,
    vineLength: 'long',
    left: 188,
    top: 140,
    photos: [
      { caption: '', bg: '#cce4b4', imageUrl: '/images/expo-1.jpeg' },
      { caption: '', bg: '#d0eab8', imageUrl: '/images/expo-2.jpeg' },
      { caption: '', bg: '#cce4b4', imageUrl: '/images/expo-3.jpeg' },
      { caption: '', bg: '#d0eab8', imageUrl: '/images/expo-4.jpeg' },
      { caption: '', bg: '#cce4b4', imageUrl: '/images/expo-5.jpeg' },
      { caption: '', bg: '#d0eab8', imageUrl: '/images/expo-6.jpeg' },
      { caption: '', bg: '#cce4b4', imageUrl: '/images/expo-7.jpeg' },
      { caption: '', bg: '#d0eab8', imageUrl: '/images/expo-8.jpeg' },
      { caption: '', bg: '#cce4b4', imageUrl: '/images/expo-9.jpeg' },
      { caption: '', bg: '#d0eab8', imageUrl: '/images/expo-10.jpeg' },
      { caption: '', bg: '#cce4b4', imageUrl: '/images/expo-11.jpeg' },
      { caption: '', bg: '#d0eab8', imageUrl: '/images/expo-12.jpeg' },
    ],
  },

  {
    id: 'case-post-2025',
    title: 'Case Post 2025',
    cardCaption: 'Case Post\n2025',
    date: '2025',
    description: 'High-impact case competition — teams tackled real business challenges under time pressure, with industry mentors evaluating solutions.',
    bg: '#e0f4cc',
    rotation: -4,
    vineLength: 'mid',
    left: 348,
    top: 32,
    photos: [
      { caption: '', bg: '#e0f4cc', imageUrl: '/images/case-post-4.jpeg' },
      { caption: '', bg: '#cce4b4', imageUrl: '/images/case-post-5.jpeg' },
      { caption: '', bg: '#e0f4cc', imageUrl: '/images/case-post-6.jpeg' },
      { caption: '', bg: '#cce4b4', imageUrl: '/images/case-post-7.jpeg' },
      { caption: '', bg: '#e0f4cc', imageUrl: '/images/case-post-8.jpeg' },
      { caption: '', bg: '#cce4b4', imageUrl: '/images/case-post-9.jpeg' },
      { caption: '', bg: '#e0f4cc', imageUrl: '/images/case-post-10.jpeg' },
      { caption: '', bg: '#cce4b4', imageUrl: '/images/case-post-11.jpeg' },
      { caption: '', bg: '#e0f4cc', imageUrl: '/images/case-post-12.jpeg' },
      { caption: '', bg: '#cce4b4', imageUrl: '/images/case-post-13.jpeg' },
    ],
  },

  {
    id: 'throwback-24',
    title: "Throwback to '24",
    cardCaption: "Throwback\nto '24",
    date: '2024',
    description: "Consult Con curtain raiser, SoPact at IIT-M, IIM-B Vistas Young Leaders Summit, and Club Expo 2024.",
    bg: '#d0e8b8',
    rotation: 5,
    vineLength: 'short',
    left: 510,
    top: 135,
    photos: [
      { caption: 'Consult Con — Curtain Raiser, March 2024', bg: '#cce4b4', imageUrl: '/images/curtain-raiser-24.png' },
      { caption: 'SoPact · IIT Madras 2024', bg: '#c4dcb0', imageUrl: '/images/sopact-24.png' },
      { caption: 'IIM-B Vistas Young Leaders Summit', bg: '#d0e8b8', imageUrl: '/images/vistas-24.png' },
      { caption: '', bg: '#d0e8b8', imageUrl: '/images/vistas-2-24.png' },
      { caption: 'Club Expo 2024', bg: '#e0f4cc', imageUrl: '/images/expo-24-1.png' },
      { caption: '', bg: '#cce4b4', imageUrl: '/images/expo-24-2.png' },
    ],
  },
];