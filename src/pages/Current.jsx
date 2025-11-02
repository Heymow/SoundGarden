import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import WinnerBanner from "../components/WinnerBanner";
import PhaseInfo from "../components/PhaseInfo";
import SongCard from "../components/SongCard";
import SubmitModal from "../components/SubmitModal";
import { currentChallenge, previousChallenge } from "../data/mockData";

export default function Current({ onPlaySong, onNavigateToTeam, onNavigateToArtist }) {
  const { user, loginWithDiscord } = useAuth();
  const [songs, setSongs] = useState(currentChallenge.songs);
  const [votedSongId, setVotedSongId] = useState(null);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);

  // Check if user is on Discord server - for now, assume false until we have real data
  const isOnDiscordServer = user?.onDiscordServer || false;

  const handleVote = (songId) => {
    if (!user) {
      loginWithDiscord();
      return;
    }
    
    // Update vote count
    setSongs(songs.map(song => 
      song.id === songId 
        ? { ...song, votes: song.votes + 1 }
        : song
    ));
    setVotedSongId(songId);
  };

  const handleSubmit = (formData) => {
    const newSong = {
      id: 's' + (songs.length + 1),
      title: formData.title,
      participants: [formData.participant1, formData.participant2],
      sunoAccounts: [formData.sunoAccount1, formData.sunoAccount2],
      sunoUrl: formData.sunoUrl,
      imageUrl: 'https://via.placeholder.com/200',
      audioUrl: '',
      submittedAt: new Date().toISOString(),
      votes: 0
    };
    
    setSongs([...songs, newSong]);
    setIsSubmitModalOpen(false);
    alert('Song submitted successfully!');
  };

  return (
    <section className="page current-page">
      <WinnerBanner 
        winner={previousChallenge.winner} 
        theme={previousChallenge.theme}
        onPlay={onPlaySong}
        onNavigateToTeam={onNavigateToTeam}
      />

      <PhaseInfo
        phase={currentChallenge.phase}
        theme={currentChallenge.theme}
        submissionDeadline={currentChallenge.submissionDeadline}
        votingDeadline={currentChallenge.votingDeadline}
      />

      {currentChallenge.phase === 'submission' && (
        <div className="action-bar">
          <button 
            className="btn-submit"
            onClick={() => {
              if (!user) {
                loginWithDiscord();
                return;
              }
              setIsSubmitModalOpen(true);
            }}
          >
            ➕ Submit Your Song
          </button>
        </div>
      )}

      <div className="songs-section">
        <h3 className="section-title">
          {currentChallenge.phase === 'submission' ? 'Submitted Songs' : 'Vote for Your Favorite'}
        </h3>
        <div className="songs-grid">
          {songs.map(song => (
            <SongCard
              key={song.id}
              song={song}
              phase={currentChallenge.phase}
              onVote={handleVote}
              hasVoted={votedSongId === song.id}
              isLoggedIn={!!user}
              onLoginRequired={loginWithDiscord}
              onPlaySong={onPlaySong}
              onNavigateToTeam={onNavigateToTeam}
              onNavigateToArtist={onNavigateToArtist}
            />
          ))}
        </div>
      </div>

      <SubmitModal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        onSubmit={handleSubmit}
      />
    </section>
  );
}