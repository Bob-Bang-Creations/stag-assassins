// The show-off screen: live kill feed plus the graveyard grid. Public —
// no secrets here, this is what people gather around.
export default function FeedScreen({ players, events }) {
  const aliveCount = players.filter((p) => p.status === 'alive').length

  return (
    <div className="screen">
      <header className="masthead">
        <h1 className="stamp">THE FEED</h1>
        <p className="mono dim">
          {aliveCount} of {players.length} assassins still breathing
        </p>
      </header>

      <section className="dossier-card">
        <p className="field-label">THE RING</p>
        <div className="grave-grid">
          {players.map((p) => (
            <div
              key={p.id}
              className={`grave-chip ${p.status === 'dead' ? 'dead' : ''}`}
            >
              <span className="grave-name">
                {p.status === 'dead' ? '✝ ' : ''}
                {p.name}
              </span>
              <span className="mono dim grave-kills">
                {p.kills > 0 ? `${p.kills} kill${p.kills > 1 ? 's' : ''}` : '—'}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="dossier-card">
        <p className="field-label">DISPATCHES</p>
        <EventList events={events} />
      </section>
    </div>
  )
}

export function EventList({ events }) {
  if (!events || events.length === 0) {
    return <p className="mono dim">Nothing yet. Stay paranoid.</p>
  }
  return (
    <ul className="feed-list">
      {events.map((e) => (
        <li key={e.id} className={`feed-row feed-${e.type}`}>
          <span className="feed-time mono dim">{formatTime(e.at)}</span>
          <span className="feed-text mono">{e.text}</span>
        </li>
      ))}
    </ul>
  )
}

function formatTime(at) {
  if (!at || typeof at.toDate !== 'function') return '··:··'
  const d = at.toDate()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
