import { useEffect, useState } from 'react'
import ArmedButton from '../components/ArmedButton'
import ResetGamePanel from '../components/ResetGamePanel'
import {
  confirmDeath,
  fetchRing,
  gmApproveReclaim,
  gmEndGame,
  gmPressure,
  gmRemovePlayer,
  gmRerollMission,
  shuffled,
} from '../game'

// The organiser's toolbox. Full-ring visibility is an adjudication tool, not
// a cheat sheet — the GM plays too, so their own hunter stays redacted until
// they deliberately tap it (honesty required, it's a stag do not the Hague).
export default function GMScreen({ uid, me, players, reclaims, loadRing }) {
  const [ring, setRing] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [ringStamp, setRingStamp] = useState(0)
  const [showMyHunter, setShowMyHunter] = useState(false)

  const playersKey = players.map((p) => `${p.id}:${p.status}`).join('|')
  useEffect(() => {
    let cancelled = false
    const load = loadRing ?? fetchRing
    load(players).then((edges) => {
      if (!cancelled) setRing(edges)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playersKey, ringStamp])

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
                <ArmedButton
                  className="ghost-btn danger"
                  disabled={busy}
                  label="FORCE CONFIRM DEATH"
                  armedLabel={`KILL ${v.name.toUpperCase()}? TAP AGAIN`}
                  onFire={() =>
                    run('Force confirm', async () => {
                      const outcome = await confirmDeath({ victimUid: v.id })
                      if (outcome === 'assassin_dead') {
                        throw new Error(
                          'Tangled — the kill did not stand (their assassin ' +
                            'died first). Adjudicate by hand.',
                        )
                      }
                    })
                  }
                />
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
                Someone claims to be {r.name} on a new phone{' '}
                <span className="dim">
                  (device …{r.id.slice(-4)}
                  {r.at?.toDate
                    ? `, asked ${String(r.at.toDate().getHours()).padStart(2, '0')}:${String(r.at.toDate().getMinutes()).padStart(2, '0')}`
                    : ''}
                  )
                </span>
              </p>
              <p className="hint mono dim">
                Check it's really them IN PERSON — their old phone gets
                logged out of the game.
              </p>
              <ArmedButton
                className="ghost-btn"
                disabled={busy}
                label="APPROVE RE-LINK"
                armedLabel={`REALLY ${r.name.toUpperCase()}? TAP AGAIN`}
                onFire={() =>
                  run('Re-link', () =>
                    gmApproveReclaim({ newUid: r.id, players, reclaims }),
                  )
                }
              />
            </div>
          ))}
        </section>
      )}

      <section className="dossier-card">
        <p className="field-label">THE RING (ADJUDICATION ONLY)</p>
        {ring === null ? (
          <p className="mono dim">Decrypting…</p>
        ) : ring.length === 0 ? (
          <p className="mono dim">
            No missions readable — check signal and reopen the panel.
          </p>
        ) : (
          <ul className="ring-list">
            {/* Your own hunter sinks to the bottom, redacted until tapped —
                you're playing too, and adjudication rarely needs that row. */}
            {[...ring]
              .sort((a, b) => (a.target?.id === uid) - (b.target?.id === uid))
              .map((edge) => {
                const huntsMe = edge.target?.id === uid
                if (huntsMe && !showMyHunter) {
                  return (
                    <li key={edge.hunter.id} className="ring-row mono">
                      <button
                        type="button"
                        className="ghost-btn"
                        onClick={() => setShowMyHunter(true)}
                      >
                        YOUR OWN HUNTER — TAP ONLY IF ADJUDICATING
                      </button>
                    </li>
                  )
                }
                return (
                  <li key={edge.hunter.id} className="ring-row mono">
                    <span className="ring-hunter">{edge.hunter.name}</span>
                    <span className="dim"> hunts </span>
                    <span className="ring-target">{edge.target?.name ?? '?'}</span>
                    <span className="dim"> · {edge.object} · {edge.location}</span>
                  </li>
                )
              })}
          </ul>
        )}
      </section>

      <section className="dossier-card">
        <p className="field-label">AGENTS</p>
        {ring === null && (
          <p className="hint mono dim">
            Ring still decrypting — REMOVE unlocks when it loads.
          </p>
        )}
        {alive.map((p) => {
          const hunterEdge = ring?.find((e) => e.target?.id === p.id)
          return (
            <div key={p.id} className="gm-row">
              <p className="mono">
                {p.name} · {p.kills} kill{p.kills === 1 ? '' : 's'}
              </p>
              <div className="gm-btn-row">
                <ArmedButton
                  className="ghost-btn"
                  disabled={busy}
                  label="REROLL"
                  armedLabel="NEW ORDERS? TAP AGAIN"
                  onFire={() =>
                    run('Reroll', () =>
                      gmRerollMission({ playerUid: p.id, playerName: p.name }),
                    )
                  }
                />
                <ArmedButton
                  className="ghost-btn danger"
                  disabled={busy || !hunterEdge}
                  label="REMOVE"
                  armedLabel="NO KILL CREDIT. TAP AGAIN"
                  onFire={() =>
                    run('Remove', () =>
                      gmRemovePlayer({
                        removedUid: p.id,
                        assassinUid: hunterEdge.hunter.id,
                      }),
                    )
                  }
                />
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
          onClick={() =>
            run('Taunt', async () =>
              gmPressure(shuffled(alive).slice(0, 2).map((p) => p.name)),
            )
          }
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
            <ArmedButton
              key={p.id}
              className="ghost-btn danger"
              disabled={busy}
              label={`CROWN ${p.name.toUpperCase()} (${p.kills})`}
              armedLabel="ENDS THE GAME FOREVER. TAP AGAIN"
              onFire={() =>
                run('End game', () =>
                  gmEndGame({ winnerUid: p.id, winnerName: p.name }),
                )
              }
            />
          ))}
      </section>

      {me.status === 'alive' && (
        <p className="hint mono dim centered-text">
          You're still playing. Close this panel and stop peeking at your own
          assassin. Honesty required — it's a stag do, not the Hague.
        </p>
      )}

      <ResetGamePanel />
    </div>
  )
}
