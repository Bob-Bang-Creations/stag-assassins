import { useState } from 'react'
import { joinGame, requestReclaim } from '../game'
import { ROSTER } from '../gameConfig'

export default function JoinScreen({ uid, game, players }) {
  const [code, setCode] = useState('')
  const [name, setName] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [reclaimSent, setReclaimSent] = useState(false)

  async function handleReclaim() {
    setError(null)
    setBusy(true)
    try {
      await requestReclaim({ uid, name, code })
      setReclaimSent(true)
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  // The game started without you. Two legitimate reasons to be here mid-game:
  // you never joined (tough luck), or you're a player on a NEW phone — the
  // re-link request covers that.
  if (game && game.status !== 'lobby') {
    if (game.status === 'finished') {
      return (
        <div className="screen centered">
          <h1 className="stamp">STAG ASSASSINS</h1>
          <div className="dossier-card">
            <p className="mono">
              This game is over. Ask the Game Master about the next one.
            </p>
          </div>
        </div>
      )
    }
    return (
      <div className="screen">
        <header className="masthead">
          <h1 className="stamp">STAG ASSASSINS</h1>
          <p className="mono dim">The game is already underway.</p>
        </header>
        <div className="dossier-card">
          <p className="mono">
            Too late to join fresh. But if you're already playing and this is
            a new phone (dead battery, cleared Safari), request a re-link and
            the Game Master will move you over.
          </p>
          {reclaimSent && (
            <p className="mono">
              Request sent{name ? ` as ${name}` : ''}. Find the Game Master —
              they approve it from their panel. Wrong name? Pick again and
              resend.
            </p>
          )}
          <>
              <p className="field-label">WHO ARE YOU?</p>
              <div className="name-grid">
                {ROSTER.map((rosterName) => (
                  <button
                    key={rosterName}
                    type="button"
                    className={`name-chip ${name === rosterName ? 'selected' : ''}`}
                    onClick={() => {
                      setName(rosterName)
                      setReclaimSent(false)
                    }}
                  >
                    {rosterName}
                  </button>
                ))}
              </div>
              <label className="field-label" htmlFor="reclaim-code">JOIN CODE</label>
              <input
                id="reclaim-code"
                className="big-input mono"
                type="text"
                autoCapitalize="characters"
                autoComplete="off"
                placeholder="Check WhatsApp"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
              {error && <p className="error mono">{error}</p>}
              <button
                type="button"
                className="primary-btn"
                disabled={!name || code.trim() === '' || busy}
                onClick={handleReclaim}
              >
                {busy ? 'SENDING…' : reclaimSent ? 'RESEND RE-LINK' : 'REQUEST RE-LINK'}
              </button>
          </>
        </div>
      </div>
    )
  }

  const takenNames = new Set(players.map((p) => p.name))
  // Someone else can claim the selected name between selecting it and
  // submitting; the live snapshot catches it before submit.
  const nameTaken = name !== null && takenNames.has(name)
  const ready = code.trim() !== '' && name !== null && !nameTaken && !busy

  async function handleJoin() {
    setError(null)
    setBusy(true)
    try {
      await joinGame({ uid, name, code })
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
    // On success the player doc snapshot flips App to the lobby.
  }

  return (
    <div className="screen">
      <header className="masthead">
        <h1 className="stamp">STAG ASSASSINS</h1>
        <p className="mono dim">Manchester · Sat 18 July · 11 players enter, 1 walks out</p>
      </header>

      <section className="dossier-card">
        <label className="field-label" htmlFor="join-code">JOIN CODE</label>
        <input
          id="join-code"
          className="big-input mono"
          type="text"
          autoCapitalize="characters"
          autoComplete="off"
          placeholder="Check WhatsApp"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
        />

        <p className="field-label">WHO ARE YOU?</p>
        <div className="name-grid">
          {ROSTER.map((rosterName) => {
            const taken = takenNames.has(rosterName)
            return (
              <button
                key={rosterName}
                type="button"
                className={`name-chip ${name === rosterName ? 'selected' : ''}`}
                disabled={taken}
                onClick={() => setName(rosterName)}
              >
                {rosterName}
                {taken && <span className="chip-note"> · in</span>}
              </button>
            )
          })}
        </div>
        {nameTaken && !reclaimSent && (
          <div>
            <p className="error mono">
              {name} is claimed on another phone. If that's really you (new
              phone?), enter the join code above and request a re-link.
            </p>
            <button
              type="button"
              className="ghost-btn"
              disabled={code.trim() === '' || busy}
              onClick={handleReclaim}
            >
              REQUEST RE-LINK
            </button>
          </div>
        )}
        {reclaimSent && (
          <p className="mono">
            Request sent. Find the Game Master — they approve it from their
            panel.
          </p>
        )}

        {error && <p className="error mono">{error}</p>}

        <button type="button" className="primary-btn" disabled={!ready} onClick={handleJoin}>
          {busy ? 'JOINING…' : 'ENTER THE GAME'}
        </button>
      </section>
    </div>
  )
}
