// Mock data for Collab Warz challenges

// Calculate current phase based on day of week
export const getCurrentPhase = () => {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  // Monday (1) to Wednesday evening (3) = submission
  // Wednesday evening to Sunday evening = voting
  // For simplicity: Mon-Wed = submission, Thu-Sun = voting
  
  if (day >= 1 && day <= 3) {
    return 'submission';
  } else {
    return 'voting';
  }
};

// Mock current challenge
export const currentChallenge = {
  id: 'cw_2025_week_44',
  theme: 'Cosmic Dreams',
  weekNumber: 44,
  year: 2025,
  phase: getCurrentPhase(),
  submissionDeadline: '2025-11-05T23:59:59',
  votingDeadline: '2025-11-09T23:59:59',
  songs: [
    {
      id: 's1',
      title: 'Starlight Journey',
      participants: ['Alice', 'Bob'],
      sunoAccounts: ['@alice_music', '@bob_beats'],
      sunoUrl: 'https://suno.com/song/mock-id-1',
      imageUrl: 'https://cdn.suno.com/image/mock-1.jpg',
      audioUrl: 'https://cdn.suno.com/audio/mock-1.mp3',
      submittedAt: '2025-11-02T14:30:00',
      votes: 15
    },
    {
      id: 's2',
      title: 'Nebula Whispers',
      participants: ['Carol', 'Dave'],
      sunoAccounts: ['@carol_tunes', '@dave_synth'],
      sunoUrl: 'https://suno.com/song/mock-id-2',
      imageUrl: 'https://cdn.suno.com/image/mock-2.jpg',
      audioUrl: 'https://cdn.suno.com/audio/mock-2.mp3',
      submittedAt: '2025-11-03T10:15:00',
      votes: 23
    },
    {
      id: 's3',
      title: 'Galactic Vibes',
      participants: ['Eve', 'Frank'],
      sunoAccounts: ['@eve_rhythms', '@frank_sounds'],
      sunoUrl: 'https://suno.com/song/mock-id-3',
      imageUrl: 'https://cdn.suno.com/image/mock-3.jpg',
      audioUrl: 'https://cdn.suno.com/audio/mock-3.mp3',
      submittedAt: '2025-11-04T16:45:00',
      votes: 18
    }
  ]
};

// Mock previous challenge (last week's winner)
export const previousChallenge = {
  id: 'cw_2025_week_43',
  theme: 'Urban Legends',
  weekNumber: 43,
  year: 2025,
  winner: {
    id: 'ws1',
    title: 'City of Shadows',
    participants: ['Grace', 'Henry'],
    sunoAccounts: ['@grace_vocals', '@henry_prod'],
    sunoUrl: 'https://suno.com/song/winner-mock-id',
    imageUrl: 'https://cdn.suno.com/image/winner.jpg',
    audioUrl: 'https://cdn.suno.com/audio/winner.mp3',
    votes: 45
  }
};

// Mock challenge history
export const challengeHistory = [
  {
    id: 'cw_2025_week_43',
    theme: 'Urban Legends',
    weekNumber: 43,
    year: 2025,
    endDate: '2025-10-27',
    winner: {
      title: 'City of Shadows',
      participants: ['Grace', 'Henry'],
      votes: 45
    },
    totalSubmissions: 8
  },
  {
    id: 'cw_2025_week_42',
    theme: 'Ocean Depths',
    weekNumber: 42,
    year: 2025,
    endDate: '2025-10-20',
    winner: {
      title: 'Underwater Melody',
      participants: ['Ivy', 'Jack'],
      votes: 38
    },
    totalSubmissions: 12
  },
  {
    id: 'cw_2025_week_41',
    theme: 'Retro Future',
    weekNumber: 41,
    year: 2025,
    endDate: '2025-10-13',
    winner: {
      title: 'Neon Nights',
      participants: ['Kate', 'Liam'],
      votes: 41
    },
    totalSubmissions: 10
  },
  {
    id: 'cw_2025_week_40',
    theme: 'Forest Tales',
    weekNumber: 40,
    year: 2025,
    endDate: '2025-10-06',
    winner: {
      title: 'Whispers of the Woods',
      participants: ['Mia', 'Noah'],
      votes: 36
    },
    totalSubmissions: 9
  }
];
