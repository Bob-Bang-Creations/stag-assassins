import { JOIN_CODE, ROSTER } from '../gameConfig'

export default function LobbyScreen({ me, players }) {
  const joinedNames = new Set(players.map((p) => p.name))
  const missing = ROSTER.filter((name) => !joinedNames.has(name))

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

      {me.isGM ? (
        <section className="dossier-card">
          <p className="field-label">GAME MASTER</p>
          <p className="mono dim">
            {missing.length === 0
              ? 'All agents present.'
              : `Still waiting on ${missing.join(', ')}.`}
          </p>
          <button
            type="button"
            className="primary-btn"
            onClick={() =>
              alert('The ring shuffle lands in the next build stage.')
            }
          >
            START THE GAME
          </button>
          <p className="hint mono dim">
            Starting deals every agent a target, an object and a location. No
            going back.
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
