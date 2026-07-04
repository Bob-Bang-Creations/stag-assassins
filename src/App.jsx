import { useEffect, useState } from 'react'
import { collection, doc, onSnapshot } from 'firebase/firestore'
import { db, ensureSignedIn, isConfigured } from './firebase'
import { GAME_ID, ROSTER } from './gameConfig'
import JoinScreen from './screens/JoinScreen'
import LobbyScreen from './screens/LobbyScreen'
import MissionScreen from './screens/MissionScreen'

// Dev-only: preview any screen without Firebase, e.g. /?preview=join,
// ?preview=lobby or ?preview=mission. Stripped from production builds.
function devPreview() {
  if (!import.meta.env.DEV) return null
  const which = new URLSearchParams(window.location.search).get('preview')
  if (!which) return null
  const fakePlayers = ['Bob', 'Alex', 'Liam', 'Matt'].map((name, i) => ({
    id: `fake-${i}`,
    name,
    status: 'alive',
    kills: 0,
  }))
  const fakeGame = {
    status: 'lobby',
    joinCode: 'STAG18',
    playerCount: 4,
    gmUid: 'fake-0',
  }
  if (which === 'join') {
    return <JoinScreen uid="preview" game={fakeGame} players={fakePlayers} />
  }
  if (which === 'lobby') {
    return (
      <LobbyScreen me={fakePlayers[0]} isGM players={fakePlayers} />
    )
  }
  if (which === 'mission') {
    return (
      <MissionScreen
        uid="fake-0"
        me={fakePlayers[0]}
        mission={{ targetId: 'fake-2', object: 'a rubber duck', location: 'at the bar' }}
        players={fakePlayers}
        checkPin={(pin) => pin === '1234'}
      />
    )
  }
  return null
}

export default function App() {
  const [uid, setUid] = useState(null)
  const [authError, setAuthError] = useState(null)
  const [game, setGame] = useState(undefined) // undefined = loading, null = no doc yet
  const [me, setMe] = useState(undefined)
  const [players, setPlayers] = useState([])
  const [mission, setMission] = useState(null)

  useEffect(() => {
    if (!isConfigured) return undefined
    return ensureSignedIn(
      (user) => setUid(user.uid),
      (err) => setAuthError(err),
    )
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

  // Own mission: only exists (and is only readable) once the game is live.
  const gameActive = game?.status === 'active'
  useEffect(() => {
    if (!uid || !gameActive) {
      setMission(null)
      return undefined
    }
    return onSnapshot(
      doc(db, 'games', GAME_ID, 'players', uid, 'private', 'mission'),
      (snap) => setMission(snap.exists() ? snap.data() : null),
    )
  }, [uid, gameActive])

  const preview = devPreview()
  if (preview) return preview

  // GM status comes from the game doc's locked gmUid, never from a player
  // doc field a joined player could forge.
  const isGM = Boolean(uid && game && game.gmUid === uid)

  let screen
  if (!isConfigured) {
    screen = <SetupNotice />
  } else if (authError) {
    screen = <AuthErrorScreen error={authError} />
  } else if (!uid || me === undefined || game === undefined) {
    screen = <LoadingScreen />
  } else if (!me) {
    screen = <JoinScreen uid={uid} game={game} players={players} />
  } else if (game?.status === 'active') {
    screen =
      me.status === 'alive' ? (
        <MissionScreen uid={uid} me={me} mission={mission} players={players} />
      ) : (
        <DeadPlaceholder me={me} />
      )
  } else if (game?.status === 'finished') {
    screen = <FinishedPlaceholder />
  } else {
    screen = <LobbyScreen me={me} isGM={isGM} players={players} />
  }

  return (
    <>
      <OfflineBanner />
      {screen}
    </>
  )
}

// The Firestore SDK retries quietly; this banner is so people blame the
// signal, not the app, and don't force-refresh mid-action.
function OfflineBanner() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])
  if (online) return null
  return (
    <div className="offline-banner mono" role="status">
      NO SIGNAL — reconnecting. Don't refresh; hold your position.
    </div>
  )
}

function DeadPlaceholder({ me }) {
  return (
    <div className="screen centered">
      <h1 className="stamp">ELIMINATED</h1>
      <p className="mono dim">
        {me.name}, your war is over. The spectator view arrives in a later
        build stage.
      </p>
    </div>
  )
}

function FinishedPlaceholder() {
  return (
    <div className="screen centered">
      <h1 className="stamp">GAME OVER</h1>
      <p className="mono dim">The winner screen arrives in a later build stage.</p>
    </div>
  )
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

function AuthErrorScreen({ error }) {
  return (
    <div className="screen centered">
      <h1 className="stamp">STAG ASSASSINS</h1>
      <div className="dossier-card">
        <p className="error mono">
          Couldn't establish a secure channel: {error.message}
        </p>
        <p className="mono dim">
          Usually this means Anonymous Auth isn't enabled in the Firebase
          console, or there's no signal.
        </p>
        <button
          type="button"
          className="primary-btn"
          onClick={() => window.location.reload()}
        >
          RETRY
        </button>
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
