import { useEffect, useRef, useState } from "react";
import { content } from "@clave/content";
import type { Role } from "@clave/engine";
import { useAppStore } from "../store.js";
import { MusicButton } from "./MusicPlayer.js";
import { CALL_SECTION, RulesButton, useRules } from "./RulesDialog.js";
import { SoundEffectsButton } from "./SoundEffects.js";

function RoleChoice({
  value,
  onChange,
  legend,
}: {
  value: Role;
  onChange: (role: Role) => void;
  legend: string;
}) {
  const choose = (role: Role, target: HTMLElement) => {
    onChange(role);
    target.parentElement?.querySelector<HTMLElement>(`[data-role="${role}"]`)?.focus();
  };
  return (
    <fieldset className="role-choice" role="radiogroup">
      <legend>{legend}</legend>
      {(["lead", "follow"] as const).map((role) => (
        <button
          key={role}
          type="button"
          role="radio"
          aria-checked={value === role}
          tabIndex={value === role ? 0 : -1}
          data-role={role}
          className={value === role ? "selected" : ""}
          onClick={() => onChange(role)}
          onKeyDown={(event) => {
            if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
              event.preventDefault();
              choose(role === "lead" ? "follow" : "lead", event.currentTarget);
            }
          }}
        >
          {role === "lead" ? "Lead" : "Follow"}
        </button>
      ))}
    </fieldset>
  );
}

export function HomeScreen() {
  const [createRole, setCreateRole] = useState<Role>("lead");
  const [joinRole, setJoinRole] = useState<Role>("follow");
  const [joinCode, setJoinCode] = useState("");
  const [showNetwork, setShowNetwork] = useState(false);
  const joinButton = useRef<HTMLButtonElement>(null);
  const { openRules } = useRules();
  const {
    hasHotseatResume,
    hasOnlineResume,
    newHotseat,
    resumeHotseat,
    discardHotseat,
    createOnline,
    joinOnline,
    resumeOnline,
    forgetOnline,
  } = useAppStore();

  useEffect(() => {
    // An invite link (#join=CODE) opens the join form with the code and the open seat chosen.
    const invited = /^#join=([A-Za-z0-9_-]+)$/.exec(location.hash)?.[1]?.toUpperCase();
    if (!invited) return;
    history.replaceState(null, "", location.pathname + location.search);
    setJoinCode(invited);
    setShowNetwork(true);
    void fetch(`/api/rooms/${encodeURIComponent(invited)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { availableRole?: Role | null } | null) => {
        if (body?.availableRole) setJoinRole(body.availableRole);
        joinButton.current?.focus();
      })
      .catch(() => undefined);
  }, []);

  return (
    <main className="home">
      <header className="brand-lockup" aria-label="Clave">
        <span className="brand-eyebrow">A partner dance game</span>
        <h1>CLAVE</h1>
        <p>Dance the song together.</p>
        <RulesButton />
      </header>

      <section className="home-intro">
        <figure className="home-hero">
          <img
            src="/art/home-hero.webp"
            srcSet="/art/home-hero-960.webp 960w, /art/home-hero.webp 1536w"
            sizes="(max-width: 740px) calc(100vw - 32px), (max-width: 1240px) 44vw, 520px"
            width={1536}
            height={1024}
            alt="A couple dancing salsa on a painted floor while a six-piece band plays behind them: piano, congas, double bass, timbales, trumpet, and trombone."
            fetchPriority="high"
            decoding="async"
            draggable={false}
          />
        </figure>
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
          {content.rules.call && (
            <button
              type="button"
              className="home-whats-new"
              onClick={() => openRules(CALL_SECTION)}
              aria-haspopup="dialog"
            >
              <span>New</span>
              <span>Call and answer</span>
              <span aria-hidden="true">→</span>
            </button>
          )}
          <div className="home-audio-controls" role="group" aria-label="Audio controls">
            <MusicButton />
            <SoundEffectsButton />
          </div>
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
            <button type="button" className="text-button" onClick={forgetOnline}>
              Forget
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
                  onChange={(event) =>
                    setJoinCode(event.target.value.replace(/\s+/g, "").toUpperCase())
                  }
                  placeholder="PASTE CODE"
                  autoCapitalize="characters"
                  required
                />
              </label>
              <RoleChoice value={joinRole} onChange={setJoinRole} legend="I’ll dance as" />
              <button ref={joinButton} type="submit" className="button cream full">
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
