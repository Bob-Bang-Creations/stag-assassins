import { useEffect, useState } from 'react'
import {
  confirmDeath,
  fetchRing,
  gmApproveReclaim,
  gmEndGame,
  gmPressure,
  gmRemovePlayer,
  gmRerollMission,
  verifyPin,
} from '../game'

// The organiser's toolbox. PIN-gated with the GM's own PIN (the GM plays
// too — full-ring visibility is an adjudication tool, not a cheat sheet,
// and the gate keeps a borrowed phone out of it).
export default function GMScreen({ uid, me, players, reclaims, checkPin, loadRing }) {
  const [unlocked, setUnlocked] = useState(false)
  const [pin, setPin] = useState('')
  const [ring, setRing] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [ringStamp, setRingStamp] = useState(0)

  useEffect(() => {
    function relock() {
      if (document.hidden) {
        setUnlocked(false)
        setPin('')
      }
    }
    document.addEventListener('visibilitychange', relock)
    return () => document.removeEventListener('visibilitychange', relock)
  }, [])

  const playersKey = players.map((p) => `${p.id}:${p.status}`).join('|')
  useEffect(() => {
    if (!unlocked) return undefined
    let cancelled = false
    const load = loadRing ?? fetchRing
    load(players).then((edges) => {
      if (!cancelled) setRing(edges)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked, playersKey, ringStamp])

  const alive = players.filter((p) => p.status === 'alive')
  const pendingVictims = players.filter(
    (p) => p.status === 'alive' && p.pendingKillFrom,
  )
  const byId = new Map(players.map((p) => [p.id, p]))

  async function run(label, fn) {
    setError(null)
    setBusy(true)
    try {
      await fn()
      setRingStamp((n) => n + 1) // ring likely changed
    } catch (err) {
      setError(`${label}: ${err.message}`)
    }
    setBusy(false)
  }

  async function handleUnseal() {
    setError(null)
    setBusy(true)
    try {
      const ok = await (checkPin ? checkPin(pin) : verifyPin(uid, pin))
      if (ok) {
        setUnlocked(true)
        setPin('')
      } else {
        setError('Wrong PIN.')
      }
    } catch {
      setError('No signal — try again when you reconnect.')
    }
    setBusy(false)
  }

  if (!unlocked) {
    return (
      <div className="screen centered">
        <div className="dossier-card mission-card sealed">
          <p className="classified-stamp">GM ONLY</p>
          <label className="field-label" htmlFor="gm-pin">ENTER YOUR PIN</label>
          <input
            id="gm-pin"
            className="big-input mono pin-mask"
            type="text"
            inputMode="numeric"
            maxLength={4}
            autoComplete="off"
            placeholder="0000"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          />
          {error && <p className="error mono">{error}</p>}
          <button
            type="button"
            className="primary-btn"
            disabled={!/^\d{4}$/.test(pin) || busy}
            onClick={handleUnseal}
          >
            {busy ? 'CHECKING…' : 'OPEN THE PANEL'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      <header className="masthead">
        <h1 className="stamp">GAME MASTER</h1>
        <p className="mono dim">Your word is final. Use it sparingly.</p>
      </header>

      {error && <p className="error mono">{error}</p>}

      {pendingVictims.length > 0 && (
        <section className="dossier-card">
          <p className="field-label">PENDING KILL REPORTS</p>
          {pendingVictims.map((v) => {
            const reporter = byId.get(v.pendingKillFrom)
            return (
              <div key={v.id} className="gm-row">
                <p className="mono">
                  {reporter?.name ?? '?'} claims {v.name} ·{' '}
                  {v.pendingKillObject} · {v.pendingKillLocation}
                </p>
                <button
                  type="button"
                  className="ghost-btn danger"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm(`Force-confirm ${v.name}'s death? Use when their phone is dead or they refuse.`)) {
                      run('Force confirm', () => confirmDeath({ victimUid: v.id }))
                    }
                  }}
                >
                  FORCE CONFIRM DEATH
                </button>
              </div>
            )
          })}
        </section>
      )}

      {reclaims.length > 0 && (
        <section className="dossier-card">
          <p className="field-label">PHONE-SWITCH REQUESTS</p>
          {reclaims.map((r) => (
            <div key={r.id} className="gm-row">
              <p className="mono">
                Someone claims to be {r.name} on a new phone.
              </p>
              <button
                type="button"
                className="ghost-btn"
                disabled={busy}
                onClick={() => {
                  if (window.confirm(`Re-link ${r.name} to the new phone? Check it's really them first — their old phone gets logged out of the game.`)) {
                    run('Re-link', () => gmApproveReclaim({ newUid: r.id }))
                  }
                }}
              >
                APPROVE RE-LINK
              </button>
            </div>
          ))}
        </section>
      )}

      <section className="dossier-card">
        <p className="field-label">THE RING (ADJUDICATION ONLY)</p>
        {ring === null ? (
          <p className="mono dim">Decrypting…</p>
        ) : (
          <ul className="ring-list">
            {ring.map((edge) => (
              <li key={edge.hunter.id} className="ring-row mono">
                <span className="ring-hunter">{edge.hunter.name}</span>
                <span className="dim"> hunts </span>
                <span className="ring-target">{edge.target?.name ?? '?'}</span>
                <span className="dim"> · {edge.object} · {edge.location}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="dossier-card">
        <p className="field-label">AGENTS</p>
        {alive.map((p) => {
          const hunterEdge = ring?.find((e) => e.target?.id === p.id)
          return (
            <div key={p.id} className="gm-row">
              <p className="mono">
                {p.name} · {p.kills} kill{p.kills === 1 ? '' : 's'}
              </p>
              <div className="gm-btn-row">
                <button
                  type="button"
                  className="ghost-btn"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm(`Reroll ${p.name}'s object and location? Target stays the same.`)) {
                      run('Reroll', () => gmRerollMission({ playerUid: p.id, playerName: p.name }))
                    }
                  }}
                >
                  REROLL
                </button>
                <button
                  type="button"
                  className="ghost-btn danger"
                  disabled={busy || !hunterEdge}
                  onClick={() => {
                    if (window.confirm(`Remove ${p.name} from the game (gone home / not playing)? Their assassin inherits their target.`)) {
                      run('Remove', () =>
                        gmRemovePlayer({ removedUid: p.id, assassinUid: hunterEdge.hunter.id }),
                      )
                    }
                  }}
                >
                  REMOVE
                </button>
              </div>
            </div>
          )
        })}
      </section>

      <section className="dossier-card">
        <p className="field-label">STALLED GAME</p>
        <button
          type="button"
          className="ghost-btn"
          disabled={busy || alive.length < 2}
          onClick={() => {
            const pool = [...alive].sort(() => Math.random() - 0.5).slice(0, 2)
            gmPressure(pool.map((p) => p.name))
          }}
        >
          POST A PRESSURE TAUNT
        </button>
      </section>

      <section className="dossier-card">
        <p className="field-label">FULL TIME — CROWN A WINNER</p>
        <p className="hint mono dim">
          Whistle rule: most kills wins, earliest kill breaks ties (check the
          feed). Ending the game cannot be undone.
        </p>
        {[...alive]
          .sort((a, b) => b.kills - a.kills)
          .map((p) => (
            <button
              key={p.id}
              type="button"
              className="ghost-btn danger"
              disabled={busy}
              onClick={() => {
                if (window.confirm(`End the game and crown ${p.name} (${p.kills} kills)? This is final.`)) {
                  run('End game', () => gmEndGame({ winnerUid: p.id, winnerName: p.name }))
                }
              }}
            >
              CROWN {p.name.toUpperCase()} ({p.kills})
            </button>
          ))}
      </section>

      {me.status === 'alive' && (
        <p className="hint mono dim centered-text">
          You're still playing. Close this panel and stop peeking at your own
          assassin. Honesty required — it's a stag do, not the Hague.
        </p>
      )}
    </div>
  )
}
