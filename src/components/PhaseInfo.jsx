import React from 'react';

export default function PhaseInfo({ phase, theme, submissionDeadline, votingDeadline }) {
  const getPhaseMessage = () => {
    if (phase === 'submission') {
      return {
        title: '📝 Submission Phase',
        message: 'Submit your collaborative AI song for this week\'s challenge!',
        deadline: submissionDeadline
      };
    } else {
      return {
        title: '🗳️ Voting Phase',
        message: 'Vote for your favorite song! Login required.',
        deadline: votingDeadline
      };
    }
  };

  const phaseInfo = getPhaseMessage();
  
  const formatDeadline = (deadline) => {
    const deadlineDate = new Date(deadline);
    const now = new Date();
    const diffMs = deadlineDate - now;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    const remainingHours = diffHours % 24;
    
    let timeRemaining = '';
    if (diffDays > 0) {
      timeRemaining = `${diffDays}d ${remainingHours}h remaining`;
    } else if (diffHours > 0) {
      timeRemaining = `${diffHours}h remaining`;
    } else {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      timeRemaining = diffMinutes > 0 ? `${diffMinutes}m remaining` : 'Ended';
    }
    
    const utcString = deadlineDate.toLocaleString('en-US', { 
      timeZone: 'UTC',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    
    return { utcString, timeRemaining };
  };

  const { utcString, timeRemaining } = formatDeadline(phaseInfo.deadline);

  return (
    <div className={`phase-info phase-${phase}`}>
      <div className="phase-header">
        <h2>{phaseInfo.title}</h2>
        <span className="phase-badge">{phase}</span>
      </div>
      <p className="phase-theme">
        <strong>This Week's Theme:</strong> {theme}
      </p>
      <p className="phase-message">{phaseInfo.message}</p>
      <p className="phase-deadline">
        {phase === 'submission' ? 'Submissions close' : 'Voting closes'}: {utcString} UTC · {timeRemaining}
      </p>
      <a 
        href="https://discord.gg/g4wtWhCUV9" 
        target="_blank" 
        rel="noopener noreferrer"
        className="btn-discord-phase"
      >
        💬 Join Discord Server
      </a>
    </div>
  );
}
