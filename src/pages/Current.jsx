import React from "react";

export default function Current() {
  return (
    <section className="page current-page">
      <h2>Current</h2>
      <p>Show active collabs, live sessions, or the current challenge here.</p>

      <div className="cards">
        <div className="card">
          <h3>Collab A</h3>
          <p>Participants: Alice, Bob</p>
        </div>
        <div className="card">
          <h3>Collab B</h3>
          <p>Participants: Carol, Dave</p>
        </div>
      </div>
    </section>
  );
}