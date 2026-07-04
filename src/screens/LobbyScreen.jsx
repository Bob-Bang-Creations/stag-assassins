import { useState } from 'react'
import { gmApproveReclaim, startGame } from '../game'
import { JOIN_CODE, ROSTER } from '../gameConfig'

export default function LobbyScreen({ me, isGM, players, reclaims = [] }) {
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const joinedNames = new Set(players.map((p) => p.name))
  const missing = ROSTER.filter((name) => !joinedNames.has(name))

  async function handleStart() {
    if (
      missing.length > 0 &&
      !window.confirm(
        `Only ${players.length} of ${ROSTER.length} are in (missing: ${missing.join(', ')}). Start without them?`,
      )
    ) {
      return
    }
    setError(null)
    setBusy(true)
    try {
      await startGame({ players })
      // The game doc snapshot flips every phone to the active screen.
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="screen">
      <header className="masthead">
        <h1 className="stamp">STAG ASSASSINS</h1>
        <p className="mono dim">
          Agents assembled: {players.length} / {ROSTER.length}
        </p>
      </header>

      <section className="dossier-card">
        <p className="field-label">IN THE ROOM</p>
        <ul className="roster-list">
          {ROSTER.map((name) => {
            const joined = joinedNames.has(name)
            return (
              <li key={name} className={`roster-row ${joined ? 'joined' : 'waiting'}`}>
                <span className="roster-name">
                  {name}
                  {name === me.name ? ' (you)' : ''}
                </span>
                <span className="mono dim">{joined ? 'READY' : 'awaited'}</span>
              </li>
            )
          })}
        </ul>
      </section>

      {isGM ? (
        <section className="dossier-card">
          <p className="field-label">GAME MASTER</p>
          <p className="mono dim">
            {missing.length === 0
              ? 'All agents present.'
              : `Still waiting on ${missing.join(', ')}.`}
          </p>
          {reclaims.length > 0 && (
            <>
              <p className="field-label">PHONE-SWITCH REQUESTS</p>
              {reclaims.map((r) => (
                <div key={r.id} className="gm-row">
                  <p className="mono">Someone claims to be {r.name} on a new phone.</p>
                  <button
                    type="button"
                    className="ghost-btn"
                    disabled={busy}
                    onClick={async () => {
                      if (!window.confirm(`Re-link ${r.name}? Check it's really them first.`)) return
                      setError(null)
                      setBusy(true)
                      try {
                        await gmApproveReclaim({ newUid: r.id })
                      } catch (err) {
                        setError(err.message)
                      }
                      setBusy(false)
                    }}
                  >
                    APPROVE RE-LINK
                  </button>
                </div>
              ))}
            </>
          )}
          {error && <p className="error mono">{error}</p>}
          <button
            type="button"
            className="primary-btn"
            disabled={busy}
            onClick={handleStart}
          >
            {busy ? 'DEALING MISSIONS…' : 'START THE GAME'}
          </button>
          <p className="hint mono dim">
            Starting shuffles everyone into one ring and deals each agent a
            target, an object and a location. No going back.
          </p>
        </section>
      ) : (
        <p className="mono dim centered-text">
          Waiting for the Game Master to start the game. Share the code:{' '}
          <strong>{JOIN_CODE}</strong>
        </p>
      )}
    </div>
  )
}
