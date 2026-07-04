import { useState } from 'react'
import { joinGame } from '../game'
import { ROSTER } from '../gameConfig'

export default function JoinScreen({ uid, players }) {
  const [code, setCode] = useState('')
  const [name, setName] = useState(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const takenNames = new Set(players.map((p) => p.name))
  const pinValid = /^\d{4}$/.test(pin)
  const ready = code.trim() !== '' && name !== null && pinValid && !busy

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

        <label className="field-label" htmlFor="pin">
          SET A 4-DIGIT PIN
        </label>
        <input
          id="pin"
          className="big-input mono"
          type="password"
          inputMode="numeric"
          maxLength={4}
          autoComplete="off"
          placeholder="••••"
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
