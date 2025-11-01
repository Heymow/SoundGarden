import React from 'react';

export default function PhaseInfo({ phase, theme, submissionDeadline, votingDeadline }) {
  const getPhaseMessage = () => {
    if (phase === 'submission') {
      return {
        title: '📝 Submission Phase',
        message: 'Submit your collaborative AI song for this week\'s challenge!',
        deadline: `Submissions close: ${new Date(submissionDeadline).toLocaleString()}`
      };
    } else {
      return {
        title: '🗳️ Voting Phase',
        message: 'Vote for your favorite song! Login required.',
        deadline: `Voting closes: ${new Date(votingDeadline).toLocaleString()}`
      };
    }
  };

  const phaseInfo = getPhaseMessage();

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
      <p className="phase-deadline">{phaseInfo.deadline}</p>
    </div>
  );
}
