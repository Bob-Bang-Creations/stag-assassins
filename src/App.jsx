import { useEffect, useState } from 'react'
import { collection, doc, onSnapshot } from 'firebase/firestore'
import { db, ensureSignedIn, isConfigured } from './firebase'
import { GAME_ID, ROSTER } from './gameConfig'
import JoinScreen from './screens/JoinScreen'
import LobbyScreen from './screens/LobbyScreen'

// Dev-only: preview any screen without Firebase, e.g. /?preview=join
// or /?preview=lobby. Stripped from production builds.
function devPreview() {
  if (!import.meta.env.DEV) return null
  const which = new URLSearchParams(window.location.search).get('preview')
  if (!which) return null
  const fakePlayers = ['Bob', 'Dave', 'Jonty', 'Steve'].map((name, i) => ({
    id: `fake-${i}`,
    name,
    status: 'alive',
    kills: 0,
    isGM: name === 'Bob',
  }))
  const fakeGame = { status: 'lobby', joinCode: 'STAG18' }
  if (which === 'join') {
    return <JoinScreen uid="preview" game={fakeGame} players={fakePlayers} />
  }
  if (which === 'lobby') {
    return (
      <LobbyScreen
        uid="fake-0"
        me={fakePlayers[0]}
        game={fakeGame}
        players={fakePlayers}
      />
    )
  }
  return null
}

export default function App() {
  const [uid, setUid] = useState(null)
  const [game, setGame] = useState(undefined) // undefined = loading, null = no doc yet
  const [me, setMe] = useState(undefined)
  const [players, setPlayers] = useState([])

  useEffect(() => {
    if (!isConfigured) return undefined
    return ensureSignedIn((user) => setUid(user.uid))
  }, [])

  useEffect(() => {
    if (!uid) return undefined
    const unsubs = [
      onSnapshot(doc(db, 'games', GAME_ID), (snap) =>
        setGame(snap.exists() ? snap.data() : null),
      ),
      onSnapshot(doc(db, 'games', GAME_ID, 'players', uid), (snap) =>
        setMe(snap.exists() ? { id: snap.id, ...snap.data() } : null),
      ),
      onSnapshot(collection(db, 'games', GAME_ID, 'players'), (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        // Keep roster order, not join order.
        list.sort((a, b) => ROSTER.indexOf(a.name) - ROSTER.indexOf(b.name))
        setPlayers(list)
      }),
    ]
    return () => unsubs.forEach((unsub) => unsub())
  }, [uid])

  const preview = devPreview()
  if (preview) return preview

  if (!isConfigured) return <SetupNotice />
  if (!uid || me === undefined || game === undefined) return <LoadingScreen />
  if (!me) return <JoinScreen uid={uid} game={game} players={players} />

  // Later stages route on game.status ("active", "finished") and me.status.
  return <LobbyScreen uid={uid} me={me} game={game} players={players} />
}

function SetupNotice() {
  return (
    <div className="screen centered">
      <h1 className="stamp">STAG ASSASSINS</h1>
      <div className="dossier-card">
        <p className="mono">
          Firebase is not configured yet. Create a free (Spark plan) Firebase
          project, enable Firestore and Anonymous Auth, then paste the web
          config into <code>src/firebaseConfig.js</code>. See README.md for the
          step-by-step.
        </p>
      </div>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div className="screen centered">
      <p className="mono dim">Establishing secure channel…</p>
    </div>
  )
}
