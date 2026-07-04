import { useState } from 'react'
import { joinGame } from '../game'
import { ROSTER } from '../gameConfig'

export default function JoinScreen({ uid, game, players }) {
  const [code, setCode] = useState('')
  const [name, setName] = useState(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  // The game started without you — don't let people fill in the whole form
  // before finding out.
  if (game && game.status !== 'lobby') {
    return (
      <div className="screen centered">
        <h1 className="stamp">STAG ASSASSINS</h1>
        <div className="dossier-card">
          <p className="mono">
            The game has already started — too late to join from here. Find
            the Game Master.
          </p>
        </div>
      </div>
    )
  }

  const takenNames = new Set(players.map((p) => p.name))
  // Someone else can claim the selected name while this user types their
  // PIN; the live snapshot catches it before submit.
  const nameTaken = name !== null && takenNames.has(name)
  const pinValid = /^\d{4}$/.test(pin)
  const ready = code.trim() !== '' && name !== null && !nameTaken && pinValid && !busy

  async function handleJoin() {
    setError(null)
    setBusy(true)
    try {
      await joinGame({ uid, name, pin, code })
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
          placeholder="From the card"
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
        {nameTaken && (
          <p className="error mono">
            {name} just got claimed on another phone. If that's you, talk to
            the Game Master.
          </p>
        )}

        <label className="field-label" htmlFor="pin">
          SET A 4-DIGIT PIN
        </label>
        {/* text + inputMode, not type=password: iOS pushes keychain UI onto
            password fields. Masking is done in CSS (pin-mask). */}
        <input
          id="pin"
          className="big-input mono pin-mask"
          type="text"
          inputMode="numeric"
          maxLength={4}
          autoComplete="one-time-code"
          placeholder="0000"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
        />
        <p className="hint mono dim">
          Your PIN locks your mission card. Don't forget it, and don't use your
          bank one.
        </p>

        {error && <p className="error mono">{error}</p>}

        <button type="button" className="primary-btn" disabled={!ready} onClick={handleJoin}>
          {busy ? 'JOINING…' : 'ENTER THE GAME'}
        </button>
      </section>
    </div>
  )
}
