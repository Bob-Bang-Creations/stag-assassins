import { EventList } from './FeedScreen'

export default function WinnerScreen({ me, game, players, events }) {
  const winner = players.find((p) => p.id === game.winnerId)
  const youWon = Boolean(me && winner && me.id === winner.id)

  return (
    <div className="screen">
      <header className="masthead">
        <h1 className="stamp">{youWon ? 'YOU WON' : 'GAME OVER'}</h1>
        {winner ? (
          <p className="mono">
            {winner.name} is the last assassin standing
            {winner.kills > 0
              ? ` — ${winner.kills} kill${winner.kills > 1 ? 's' : ''}`
              : ''}
            .
          </p>
        ) : (
          <p className="mono dim">
            The whistle has gone. The Game Master crowns the winner.
          </p>
        )}
      </header>

      <section className="dossier-card">
        <p className="field-label">THE FALLEN</p>
        <div className="grave-grid">
          {players.map((p) => (
            <div
              key={p.id}
              className={`grave-chip ${
                p.status === 'dead'
                  ? 'dead'
                  : p.id === game.winnerId
                    ? 'winner'
                    : ''
              }`}
            >
              <span className="grave-name">
                {p.status === 'dead' ? '✝ ' : p.id === game.winnerId ? '★ ' : ''}
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
        <p className="field-label">HOW IT WENT DOWN</p>
        <EventList events={events} />
      </section>
    </div>
  )
}
