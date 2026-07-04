import { useEffect, useState } from 'react'
import { fetchRing } from '../game'
import { EventList } from './FeedScreen'

// Spectator mode. The gravestone softens the blow; the revealed ring and
// the feed keep the dead entertained. Honour-bound to silence.
export default function DeadScreen({ me, players, events, loadRing }) {
  const [ring, setRing] = useState(null)

  const aliveCount = players.filter((p) => p.status === 'alive').length
  const killer = players.find((p) => p.id === me.killedBy)

  // Re-fetch the ring whenever the alive set changes (each kill rewires it).
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
  }, [players.map((p) => `${p.id}:${p.status}`).join('|')])

  return (
    <div className="screen">
      <div className="dossier-card gravestone">
        <p className="grave-rip">✝</p>
        <p className="death-question">{me.name}</p>
        <p className="mono dim centered-text">
          {me.fled
            ? 'Fled the city.'
            : `Taken ${me.diedWhere ?? 'somewhere'}${killer ? ` by ${killer.name}` : ''}${me.diedWith ? ` with ${me.diedWith}` : ''}.`}
          {me.kills > 0
            ? ` Went down swinging: ${me.kills} kill${me.kills > 1 ? 's' : ''}.`
            : ''}
        </p>
        <p className="hint mono dim centered-text">
          You are a spectator now. The ring is revealed to you — you are
          honour-bound to silence.
        </p>
      </div>

      <section className="dossier-card">
        <p className="field-label">THE RING, REVEALED</p>
        {ring === null ? (
          <p className="mono dim">Exhuming the ring…</p>
        ) : ring.length === 0 ? (
          <p className="mono dim">No missions to show.</p>
        ) : (
          <ul className="ring-list">
            {ring.map((edge) => (
              <li key={edge.hunter.id} className="ring-row mono">
                <span className="ring-hunter">{edge.hunter.name}</span>
                <span className="dim"> hunts </span>
                <span className="ring-target">
                  {edge.target ? edge.target.name : '?'}
                </span>
                <span className="dim">
                  {' '}
                  · {edge.object} · {edge.location}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mono dim">
          {aliveCount} still alive. Watch. Say nothing.
        </p>
      </section>

      <section className="dossier-card">
        <p className="field-label">DISPATCHES</p>
        <EventList events={events} />
      </section>
    </div>
  )
}
