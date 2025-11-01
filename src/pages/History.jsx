import React from "react";

export default function History() {
  return (
    <section className="page history-page">
      <h2>History</h2>
      <p>Past collabs, winners, and archived sessions.</p>

      <ul className="history-list">
        <li>
          <strong>Collab X</strong> — Winner: Team Alpha — Date: 2025-09-12
        </li>
        <li>
          <strong>Collab Y</strong> — Winner: Team Beta — Date: 2025-08-04
        </li>
      </ul>
    </section>
  );
}