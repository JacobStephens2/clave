import { useState } from "react";
import type { Role } from "@clave/engine";
import { useAppStore } from "../store.js";

function RoleChoice({
  value,
  onChange,
  legend,
}: {
  value: Role;
  onChange: (role: Role) => void;
  legend: string;
}) {
  return (
    <fieldset className="role-choice">
      <legend>{legend}</legend>
      <button
        type="button"
        className={value === "lead" ? "selected" : ""}
        onClick={() => onChange("lead")}
      >
        Lead
      </button>
      <button
        type="button"
        className={value === "follow" ? "selected" : ""}
        onClick={() => onChange("follow")}
      >
        Follow
      </button>
    </fieldset>
  );
}

export function HomeScreen() {
  const [createRole, setCreateRole] = useState<Role>("lead");
  const [joinRole, setJoinRole] = useState<Role>("follow");
  const [joinCode, setJoinCode] = useState("");
  const [showNetwork, setShowNetwork] = useState(false);
  const {
    hasHotseatResume,
    hasOnlineResume,
    newHotseat,
    resumeHotseat,
    discardHotseat,
    createOnline,
    joinOnline,
    resumeOnline,
  } = useAppStore();

  return (
    <main className="home">
      <header className="brand-lockup" aria-label="Clave">
        <span className="brand-eyebrow">A partner dance game</span>
        <h1>CLAVE</h1>
        <p>Dance the song together.</p>
      </header>

      <section className="home-intro">
        <div className="home-copy">
          <p className="kicker">Two players · Cooperative · One salsa song</p>
          <h2>
            Listen. Connect.
            <br />
            Make the floor yours.
          </h2>
          <p>
            Take turns as Lead and Follow through all sixteen 8-counts of
            <em> Llorarás</em>. Build Style without losing your Connection.
          </p>
        </div>
        <div className="rhythm-mark" aria-hidden="true">
          <img src="/card-art/pos_001.webp" alt="" decoding="async" draggable={false} />
          <span>1</span>
          <i></i>
          <span>2</span>
          <i></i>
          <span>3</span>
          <b></b>
          <span>5</span>
          <i></i>
          <span>6</span>
          <i></i>
          <span>7</span>
        </div>
      </section>

      <section className="play-panel" aria-label="Start playing">
        {hasHotseatResume && (
          <div className="resume-strip">
            <div>
              <small>Saved on this device</small>
              <strong>Your dance is waiting</strong>
            </div>
            <button type="button" className="button gold" onClick={resumeHotseat}>
              Resume
            </button>
            <button type="button" className="text-button" onClick={discardHotseat}>
              Discard
            </button>
          </div>
        )}
        {hasOnlineResume && (
          <div className="resume-strip network-resume">
            <div>
              <small>Saved room seat</small>
              <strong>Return to your partner</strong>
            </div>
            <button type="button" className="button outline" onClick={resumeOnline}>
              Reconnect
            </button>
          </div>
        )}

        <button type="button" className="mode-card primary-mode" onClick={newHotseat}>
          <span className="mode-number">01</span>
          <span>
            <strong>Pass & play</strong>
            <small>One screen, handed between partners</small>
          </span>
          <span className="arrow">→</span>
        </button>

        <button
          type="button"
          className="mode-card"
          onClick={() => setShowNetwork((visible) => !visible)}
          aria-expanded={showNetwork}
        >
          <span className="mode-number">02</span>
          <span>
            <strong>Two devices</strong>
            <small>Create or join a private room</small>
          </span>
          <span className="arrow">{showNetwork ? "−" : "+"}</span>
        </button>

        {showNetwork && (
          <div className="network-panel">
            <div className="network-column">
              <h3>Create a room</h3>
              <RoleChoice value={createRole} onChange={setCreateRole} legend="I’ll dance as" />
              <button
                type="button"
                className="button gold full"
                onClick={() => void createOnline(createRole)}
              >
                Create room
              </button>
            </div>
            <div className="network-divider">
              <span>or</span>
            </div>
            <form
              className="network-column"
              onSubmit={(event) => {
                event.preventDefault();
                void joinOnline(joinCode, joinRole);
              }}
            >
              <h3>Join your partner</h3>
              <label className="code-input">
                <span>Room code</span>
                <input
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                  placeholder="PASTE CODE"
                  autoCapitalize="characters"
                  required
                />
              </label>
              <RoleChoice value={joinRole} onChange={setJoinRole} legend="I’ll dance as" />
              <button type="submit" className="button cream full">
                Join room
              </button>
            </form>
          </div>
        )}
      </section>

      <footer className="home-footer">
        <span>Best with a record playing nearby</span>
        <span aria-hidden="true">◆</span>
        <span>No timers. No pressure. Just the dance.</span>
      </footer>
    </main>
  );
}
