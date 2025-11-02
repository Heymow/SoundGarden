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
      votes: 45,
      imageUrl: 'https://cdn.suno.com/image/winner.jpg',
      audioUrl: 'https://cdn.suno.com/audio/winner.mp3',
      sunoUrl: 'https://suno.com/song/winner-mock-id'
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
      votes: 38,
      imageUrl: 'https://cdn.suno.com/image/ocean.jpg',
      audioUrl: 'https://cdn.suno.com/audio/ocean.mp3',
      sunoUrl: 'https://suno.com/song/ocean-mock-id'
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
      votes: 41,
      imageUrl: 'https://cdn.suno.com/image/neon.jpg',
      audioUrl: 'https://cdn.suno.com/audio/neon.mp3',
      sunoUrl: 'https://suno.com/song/neon-mock-id'
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
      votes: 36,
      imageUrl: 'https://cdn.suno.com/image/forest.jpg',
      audioUrl: 'https://cdn.suno.com/audio/forest.mp3',
      sunoUrl: 'https://suno.com/song/forest-mock-id'
    },
    totalSubmissions: 9
  }
];

// Mock artists data
export const artistsData = [
  {
    id: 'a1',
    name: 'Alice',
    participations: 5,
    victories: 1,
    petals: 120,
    rank: 'Flower',
    sunoProfile: 'https://suno.com/@alice_music',
    teams: ['Alice & Bob', 'Alice & Carol'],
    songs: [
      {
        title: 'Starlight Journey',
        theme: 'Cosmic Dreams',
        week: 'Week 44, 2025',
        team: 'Alice & Bob',
        votes: 15,
        isWinner: false,
        sunoUrl: 'https://suno.com/song/mock-id-1'
      },
      {
        title: 'Digital Horizons',
        theme: 'Future Tech',
        week: 'Week 40, 2025',
        team: 'Alice & Carol',
        votes: 32,
        isWinner: true,
        sunoUrl: 'https://suno.com/song/mock-id-alice-2'
      }
    ]
  },
  {
    id: 'a2',
    name: 'Bob',
    participations: 4,
    victories: 0,
    petals: 85,
    rank: 'Sprout',
    sunoProfile: 'https://suno.com/@bob_beats',
    teams: ['Alice & Bob', 'Bob & Eve'],
    songs: [
      {
        title: 'Starlight Journey',
        theme: 'Cosmic Dreams',
        week: 'Week 44, 2025',
        team: 'Alice & Bob',
        votes: 15,
        isWinner: false,
        sunoUrl: 'https://suno.com/song/mock-id-1'
      }
    ]
  },
  {
    id: 'a3',
    name: 'Carol',
    participations: 6,
    victories: 2,
    petals: 195,
    rank: 'Rosegarden',
    sunoProfile: 'https://suno.com/@carol_tunes',
    teams: ['Carol & Dave', 'Alice & Carol'],
    songs: [
      {
        title: 'Nebula Whispers',
        theme: 'Cosmic Dreams',
        week: 'Week 44, 2025',
        team: 'Carol & Dave',
        votes: 23,
        isWinner: false,
        sunoUrl: 'https://suno.com/song/mock-id-2'
      }
    ]
  },
  {
    id: 'a4',
    name: 'Dave',
    participations: 3,
    victories: 0,
    petals: 65,
    rank: 'Sprout',
    sunoProfile: 'https://suno.com/@dave_synth',
    teams: ['Carol & Dave'],
    songs: [
      {
        title: 'Nebula Whispers',
        theme: 'Cosmic Dreams',
        week: 'Week 44, 2025',
        team: 'Carol & Dave',
        votes: 23,
        isWinner: false,
        sunoUrl: 'https://suno.com/song/mock-id-2'
      }
    ]
  },
  {
    id: 'a5',
    name: 'Eve',
    participations: 7,
    victories: 3,
    petals: 245,
    rank: 'Eden',
    sunoProfile: 'https://suno.com/@eve_rhythms',
    teams: ['Eve & Frank', 'Bob & Eve'],
    songs: [
      {
        title: 'Galactic Vibes',
        theme: 'Cosmic Dreams',
        week: 'Week 44, 2025',
        team: 'Eve & Frank',
        votes: 18,
        isWinner: false,
        sunoUrl: 'https://suno.com/song/mock-id-3'
      }
    ]
  },
  {
    id: 'a6',
    name: 'Frank',
    participations: 2,
    victories: 0,
    petals: 45,
    rank: 'Seed',
    sunoProfile: 'https://suno.com/@frank_sounds',
    teams: ['Eve & Frank'],
    songs: [
      {
        title: 'Galactic Vibes',
        theme: 'Cosmic Dreams',
        week: 'Week 44, 2025',
        team: 'Eve & Frank',
        votes: 18,
        isWinner: false,
        sunoUrl: 'https://suno.com/song/mock-id-3'
      }
    ]
  },
  {
    id: 'a7',
    name: 'Grace',
    participations: 8,
    victories: 3,
    petals: 280,
    rank: 'Eden',
    sunoProfile: 'https://suno.com/@grace_vocals',
    teams: ['Grace & Henry'],
    songs: [
      {
        title: 'City of Shadows',
        theme: 'Urban Legends',
        week: 'Week 43, 2025',
        team: 'Grace & Henry',
        votes: 45,
        isWinner: true,
        sunoUrl: 'https://suno.com/song/winner-mock-id'
      }
    ]
  },
  {
    id: 'a8',
    name: 'Henry',
    participations: 5,
    victories: 2,
    petals: 165,
    rank: 'Rosegarden',
    sunoProfile: 'https://suno.com/@henry_prod',
    teams: ['Grace & Henry'],
    songs: [
      {
        title: 'City of Shadows',
        theme: 'Urban Legends',
        week: 'Week 43, 2025',
        team: 'Grace & Henry',
        votes: 45,
        isWinner: true,
        sunoUrl: 'https://suno.com/song/winner-mock-id'
      }
    ]
  }
];

