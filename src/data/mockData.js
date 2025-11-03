// Mock data for Collab Warz challenges

// Calculate current phase based on day of week
export const getCurrentPhase = () => {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday, 1 = Monday, etc.

  // Monday (1) to Wednesday evening (3) = submission
  // Wednesday evening to Sunday evening = voting
  // For simplicity: Mon-Wed = submission, Thu-Sun = voting

  if (day >= 1 && day <= 3) {
    return "submission";
  } else {
    return "voting";
  }
};

// Mock current challenge
export const currentChallenge = {
  id: "cw_2025_week_44",
  theme: "Cosmic Dreams",
  weekNumber: 44,
  year: 2025,
  phase: getCurrentPhase(),
  submissionDeadline: "2025-11-05T23:59:59",
  votingDeadline: "2025-11-09T23:59:59",
  songs: [
    {
      id: "s1",
      title: "Starlight Journey",
      participants: ["Alice", "Bob"],
      sunoAccounts: ["@alice_music", "@bob_beats"],
      sunoUrl: "https://suno.com/song/mock-id-1",
      imageUrl: "https://cdn.suno.com/image/mock-1.jpg",
      audioUrl: "https://cdn.suno.com/audio/mock-1.mp3",
      submittedAt: "2025-11-02T14:30:00",
      votes: 15,
    },
    {
      id: "s2",
      title: "Nebula Whispers",
      participants: ["Carol", "Dave"],
      sunoAccounts: ["@carol_tunes", "@dave_synth"],
      sunoUrl: "https://suno.com/song/mock-id-2",
      imageUrl: "https://cdn.suno.com/image/mock-2.jpg",
      audioUrl: "https://cdn.suno.com/audio/mock-2.mp3",
      submittedAt: "2025-11-03T10:15:00",
      votes: 23,
    },
    {
      id: "s3",
      title: "Galactic Vibes",
      participants: ["Eve", "Frank"],
      sunoAccounts: ["@eve_rhythms", "@frank_sounds"],
      sunoUrl: "https://suno.com/song/mock-id-3",
      imageUrl: "https://cdn.suno.com/image/mock-3.jpg",
      audioUrl: "https://cdn.suno.com/audio/mock-3.mp3",
      submittedAt: "2025-11-04T16:45:00",
      votes: 18,
    },
  ],
};

// Mock previous challenge (last week's winner)
export const previousChallenge = {
  id: "cw_2025_week_43",
  theme: "Urban Legends",
  weekNumber: 43,
  year: 2025,
  winner: {
    id: "ws1",
    title: "City of Shadows",
    participants: ["Grace", "Henry"],
    sunoAccounts: ["@grace_vocals", "@henry_prod"],
    sunoUrl: "https://suno.com/song/winner-mock-id",
    imageUrl: "https://cdn2.suno.ai/2c3712ef-a6e7-426b-b7da-8ad483f9a9b6.jpeg",
    audioUrl: "https://cdn.suno.com/audio/winner.mp3",
    votes: 45,
  },
};

// Mock challenge history
export const challengeHistory = [
  {
    id: "cw_2025_week_43",
    theme: "Urban Legends",
    weekNumber: 43,
    year: 2025,
    endDate: "2025-10-27",
    winner: {
      title: "City of Shadows",
      participants: ["Grace", "Henry"],
      votes: 45,
      imageUrl: "https://cdn.suno.com/image/winner.jpg",
      audioUrl: "https://cdn.suno.com/audio/winner.mp3",
      sunoUrl: "https://suno.com/song/winner-mock-id",
    },
    totalSubmissions: 8,
  },
  {
    id: "cw_2025_week_42",
    theme: "Ocean Depths",
    weekNumber: 42,
    year: 2025,
    endDate: "2025-10-20",
    winner: {
      title: "Underwater Melody",
      participants: ["Ivy", "Jack"],
      votes: 38,
      imageUrl: "https://cdn.suno.com/image/ocean.jpg",
      audioUrl: "https://cdn.suno.com/audio/ocean.mp3",
      sunoUrl: "https://suno.com/song/ocean-mock-id",
    },
    totalSubmissions: 12,
  },
  {
    id: "cw_2025_week_41",
    theme: "Retro Future",
    weekNumber: 41,
    year: 2025,
    endDate: "2025-10-13",
    winner: {
      title: "Neon Nights",
      participants: ["Kate", "Liam"],
      votes: 41,
      imageUrl: "https://cdn.suno.com/image/neon.jpg",
      audioUrl: "https://cdn.suno.com/audio/neon.mp3",
      sunoUrl: "https://suno.com/song/neon-mock-id",
    },
    totalSubmissions: 10,
  },
  {
    id: "cw_2025_week_40",
    theme: "Forest Tales",
    weekNumber: 40,
    year: 2025,
    endDate: "2025-10-06",
    winner: {
      title: "Whispers of the Woods",
      participants: ["Mia", "Noah"],
      votes: 36,
      imageUrl: "https://cdn.suno.com/image/forest.jpg",
      audioUrl: "https://cdn.suno.com/audio/forest.mp3",
      sunoUrl: "https://suno.com/song/forest-mock-id",
    },
    totalSubmissions: 9,
  },
];

// Mock artists data
export const artistsData = [
  {
    id: "a1",
    name: "Alice",
    participations: 5,
    victories: 1,
    petals: 120,
    rank: "Flower",
    sunoProfile: "https://suno.com/@alice_music",
    teams: ["Alice & Bob", "Alice & Carol"],
    songs: [
      {
        title: "Starlight Journey",
        theme: "Cosmic Dreams",
        week: "Week 44, 2025",
        team: "Alice & Bob",
        votes: 15,
        isWinner: false,
        sunoUrl: "https://suno.com/song/mock-id-1",
      },
      {
        title: "Digital Horizons",
        theme: "Future Tech",
        week: "Week 40, 2025",
        team: "Alice & Carol",
        votes: 32,
        isWinner: true,
        sunoUrl: "https://suno.com/song/mock-id-alice-2",
      },
    ],
  },
  {
    id: "a2",
    name: "Bob",
    participations: 4,
    victories: 0,
    petals: 85,
    rank: "Sprout",
    sunoProfile: "https://suno.com/@bob_beats",
    teams: ["Alice & Bob", "Bob & Eve"],
    songs: [
      {
        title: "Starlight Journey",
        theme: "Cosmic Dreams",
        week: "Week 44, 2025",
        team: "Alice & Bob",
        votes: 15,
        isWinner: false,
        sunoUrl: "https://suno.com/song/mock-id-1",
      },
    ],
  },
  {
    id: "a3",
    name: "Carol",
    participations: 6,
    victories: 2,
    petals: 195,
    rank: "Rosegarden",
    sunoProfile: "https://suno.com/@carol_tunes",
    teams: ["Carol & Dave", "Alice & Carol"],
    songs: [
      {
        title: "Nebula Whispers",
        theme: "Cosmic Dreams",
        week: "Week 44, 2025",
        team: "Carol & Dave",
        votes: 23,
        isWinner: false,
        sunoUrl: "https://suno.com/song/mock-id-2",
      },
    ],
  },
  {
    id: "a4",
    name: "Dave",
    participations: 3,
    victories: 0,
    petals: 65,
    rank: "Sprout",
    sunoProfile: "https://suno.com/@dave_synth",
    teams: ["Carol & Dave"],
    songs: [
      {
        title: "Nebula Whispers",
        theme: "Cosmic Dreams",
        week: "Week 44, 2025",
        team: "Carol & Dave",
        votes: 23,
        isWinner: false,
        sunoUrl: "https://suno.com/song/mock-id-2",
      },
    ],
  },
  {
    id: "a5",
    name: "Eve",
    participations: 7,
    victories: 3,
    petals: 245,
    rank: "Eden",
    sunoProfile: "https://suno.com/@eve_rhythms",
    teams: ["Eve & Frank", "Bob & Eve"],
    songs: [
      {
        title: "Galactic Vibes",
        theme: "Cosmic Dreams",
        week: "Week 44, 2025",
        team: "Eve & Frank",
        votes: 18,
        isWinner: false,
        sunoUrl: "https://suno.com/song/mock-id-3",
      },
    ],
  },
  {
    id: "a6",
    name: "Frank",
    participations: 2,
    victories: 0,
    petals: 45,
    rank: "Seed",
    sunoProfile: "https://suno.com/@frank_sounds",
    teams: ["Eve & Frank"],
    songs: [
      {
        title: "Galactic Vibes",
        theme: "Cosmic Dreams",
        week: "Week 44, 2025",
        team: "Eve & Frank",
        votes: 18,
        isWinner: false,
        sunoUrl: "https://suno.com/song/mock-id-3",
      },
    ],
  },
  {
    id: "a7",
    name: "Grace",
    participations: 8,
    victories: 3,
    petals: 280,
    rank: "Eden",
    sunoProfile: "https://suno.com/@grace_vocals",
    teams: ["Grace & Henry"],
    songs: [
      {
        title: "City of Shadows",
        theme: "Urban Legends",
        week: "Week 43, 2025",
        team: "Grace & Henry",
        votes: 45,
        isWinner: true,
        sunoUrl: "https://suno.com/song/winner-mock-id",
      },
    ],
  },
  {
    id: "a8",
    name: "Henry",
    participations: 5,
    victories: 2,
    petals: 165,
    rank: "Rosegarden",
    sunoProfile: "https://suno.com/@henry_prod",
    teams: ["Grace & Henry"],
    songs: [
      {
        title: "City of Shadows",
        theme: "Urban Legends",
        week: "Week 43, 2025",
        team: "Grace & Henry",
        votes: 45,
        isWinner: true,
        sunoUrl: "https://suno.com/song/winner-mock-id",
      },
    ],
  },
];

// Mock teams data
export const teamsData = [
  {
    id: "t1",
    name: "Alice & Bob",
    members: [
      { name: "Alice", sunoProfile: "https://suno.com/@alice_music" },
      { name: "Bob", sunoProfile: "https://suno.com/@bob_beats" },
    ],
    participations: 5,
    victories: 1,
    compositions: [
      {
        title: "Starlight Journey",
        theme: "Cosmic Dreams",
        week: "Week 44, 2025",
        weekNumber: 44,
        year: 2025,
        votes: 15,
        isWinner: false,
        sunoUrl: "https://suno.com/song/mock-id-1",
        participants: ["Alice", "Bob"],
      },
      {
        title: "Digital Horizons",
        theme: "Future Tech",
        week: "Week 40, 2025",
        weekNumber: 40,
        year: 2025,
        votes: 32,
        isWinner: true,
        sunoUrl: "https://suno.com/song/mock-id-alice-2",
        participants: ["Alice", "Bob"],
      },
    ],
  },
  {
    id: "t2",
    name: "Carol & Dave",
    members: [
      { name: "Carol", sunoProfile: "https://suno.com/@carol_tunes" },
      { name: "Dave", sunoProfile: "https://suno.com/@dave_synth" },
    ],
    participations: 6,
    victories: 2,
    compositions: [
      {
        title: "Nebula Whispers",
        theme: "Cosmic Dreams",
        week: "Week 44, 2025",
        weekNumber: 44,
        year: 2025,
        votes: 23,
        isWinner: false,
        sunoUrl: "https://suno.com/song/mock-id-2",
        participants: ["Carol", "Dave"],
      },
      {
        title: "Sunset Dreams",
        theme: "Summer Vibes",
        week: "Week 39, 2025",
        weekNumber: 39,
        year: 2025,
        votes: 41,
        isWinner: true,
        sunoUrl: "https://suno.com/song/mock-carol-dave-2",
        participants: ["Carol", "Dave"],
      },
    ],
  },
  {
    id: "t3",
    name: "Eve & Frank",
    members: [
      { name: "Eve", sunoProfile: "https://suno.com/@eve_rhythms" },
      { name: "Frank", sunoProfile: "https://suno.com/@frank_sounds" },
    ],
    participations: 7,
    victories: 3,
    compositions: [
      {
        title: "Galactic Vibes",
        theme: "Cosmic Dreams",
        week: "Week 44, 2025",
        weekNumber: 44,
        year: 2025,
        votes: 18,
        isWinner: false,
        sunoUrl: "https://suno.com/song/mock-id-3",
        participants: ["Eve", "Frank"],
      },
      {
        title: "Midnight Echo",
        theme: "Night Tales",
        week: "Week 38, 2025",
        weekNumber: 38,
        year: 2025,
        votes: 38,
        isWinner: true,
        sunoUrl: "https://suno.com/song/mock-eve-frank-2",
        participants: ["Eve", "Frank"],
      },
    ],
  },
  {
    id: "t4",
    name: "Grace & Henry",
    members: [
      { name: "Grace", sunoProfile: "https://suno.com/@grace_vocals" },
      { name: "Henry", sunoProfile: "https://suno.com/@henry_prod" },
    ],
    participations: 8,
    victories: 3,
    compositions: [
      {
        title: "City of Shadows",
        theme: "Urban Legends",
        week: "Week 43, 2025",
        weekNumber: 43,
        year: 2025,
        votes: 45,
        isWinner: true,
        sunoUrl: "https://suno.com/song/winner-mock-id",
        participants: ["Grace", "Henry"],
      },
      {
        title: "Electric Dreams",
        theme: "Retro Future",
        week: "Week 41, 2025",
        weekNumber: 41,
        year: 2025,
        votes: 41,
        isWinner: true,
        sunoUrl: "https://suno.com/song/mock-grace-henry-2",
        participants: ["Grace", "Henry"],
      },
    ],
  },
  {
    id: "t5",
    name: "Bob & Eve",
    members: [
      { name: "Bob", sunoProfile: "https://suno.com/@bob_beats" },
      { name: "Eve", sunoProfile: "https://suno.com/@eve_rhythms" },
    ],
    participations: 3,
    victories: 0,
    compositions: [
      {
        title: "Rhythm Nation",
        theme: "Dance Floor",
        week: "Week 37, 2025",
        weekNumber: 37,
        year: 2025,
        votes: 22,
        isWinner: false,
        sunoUrl: "https://suno.com/song/mock-bob-eve-1",
        participants: ["Bob", "Eve"],
      },
    ],
  },
  {
    id: "t6",
    name: "Alice & Carol",
    members: [
      { name: "Alice", sunoProfile: "https://suno.com/@alice_music" },
      { name: "Carol", sunoProfile: "https://suno.com/@carol_tunes" },
    ],
    participations: 2,
    victories: 1,
    compositions: [
      {
        title: "Harmony Waves",
        theme: "Ocean Depths",
        week: "Week 42, 2025",
        weekNumber: 42,
        year: 2025,
        votes: 38,
        isWinner: true,
        sunoUrl: "https://suno.com/song/mock-alice-carol-1",
        participants: ["Alice", "Carol"],
      },
    ],
  },
];
