import { useEffect, useState } from 'react'
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore'
import { db, ensureSignedIn, isConfigured } from './firebase'
import { GAME_ID, ROSTER } from './gameConfig'
import DeadScreen from './screens/DeadScreen'
import DeathConfirmScreen from './screens/DeathConfirmScreen'
import FeedScreen from './screens/FeedScreen'
import GMScreen from './screens/GMScreen'
import JoinScreen from './screens/JoinScreen'
import LobbyScreen from './screens/LobbyScreen'
import MissionScreen from './screens/MissionScreen'
import WinnerScreen from './screens/WinnerScreen'

// Dev-only: preview any screen without Firebase, e.g. /?preview=join,
// ?preview=mission, ?preview=feed, ?preview=dead, ?preview=winner.
// Stripped from production builds.
function devPreview() {
  if (!import.meta.env.DEV) return null
  const which = new URLSearchParams(window.location.search).get('preview')
  if (!which) return null
  const fakePlayers = ['Bob', 'Alex', 'Liam', 'Matt'].map((name, i) => ({
    id: `fake-${i}`,
    name,
    status: i === 3 ? 'dead' : 'alive',
    kills: i === 0 ? 2 : 0,
    diedWhere: 'in the smoking area',
    diedWith: 'a teabag',
    killedBy: 'fake-0',
  }))
  const fakeGame = {
    status: 'lobby',
    joinCode: 'STAG18',
    playerCount: 4,
    gmUid: 'fake-0',
    winnerId: 'fake-0',
  }
  const fakeEvents = [
    { id: 'e3', type: 'kill', text: 'Matt was eliminated in the smoking area with a teabag', at: null },
    { id: 'e2', type: 'start', text: 'The game is afoot.', at: null },
    { id: 'e1', type: 'join', text: 'Bob has entered the game', at: null },
  ]
  const fakeRing = [
    { hunter: fakePlayers[0], target: fakePlayers[1], object: 'a rubber duck', location: 'at the bar' },
    { hunter: fakePlayers[1], target: fakePlayers[2], object: 'a beer mat', location: 'by the door' },
    { hunter: fakePlayers[2], target: fakePlayers[0], object: 'a 1p coin', location: 'in any queue' },
  ]
  if (which === 'join') {
    return <JoinScreen uid="preview" game={fakeGame} players={fakePlayers} />
  }
  if (which === 'lobby') {
    return (
      <LobbyScreen me={fakePlayers[0]} isGM players={fakePlayers} reclaims={[]} />
    )
  }
  if (which === 'gm') {
    return (
      <GMScreen
        uid="fake-0"
        me={fakePlayers[0]}
        players={fakePlayers.map((p, i) =>
          i === 1
            ? {
                ...p,
                pendingKillFrom: 'fake-0',
                pendingKillObject: 'a rubber duck',
                pendingKillLocation: 'at the bar',
              }
            : p,
        )}
        reclaims={[{ id: 'new-uid-1', name: 'Liam' }]}
        checkPin={(pin) => pin === '1234'}
        loadRing={async () => fakeRing}
      />
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
  if (which === 'confirm') {
    return (
      <DeathConfirmScreen
        me={{
          ...fakePlayers[1],
          pendingKillFrom: 'fake-0',
          pendingKillObject: 'a teabag',
          pendingKillLocation: 'in the smoking area',
        }}
        players={fakePlayers}
        checkPin={(pin) => pin === '1234'}
        onConfirm={async () => 'died'}
        onDispute={async () => {}}
      />
    )
  }
  if (which === 'feed') {
    return <FeedScreen players={fakePlayers} events={fakeEvents} />
  }
  if (which === 'dead') {
    return (
      <DeadScreen
        me={fakePlayers[3]}
        players={fakePlayers}
        events={fakeEvents}
        loadRing={async () => fakeRing}
      />
    )
  }
  if (which === 'winner') {
    return (
      <WinnerScreen
        me={fakePlayers[0]}
        game={{ ...fakeGame, status: 'finished' }}
        players={fakePlayers}
        events={fakeEvents}
        isGM
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
  const [events, setEvents] = useState([])
  const [reclaims, setReclaims] = useState([])
  const [tab, setTab] = useState('main') // 'main' | 'feed' | 'gm'
  const [notice, setNotice] = useState(null)

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
      onSnapshot(
        query(
          collection(db, 'games', GAME_ID, 'events'),
          orderBy('at', 'desc'),
          limit(100),
        ),
        (snap) =>
          setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      ),
    ]
    return () => unsubs.forEach((unsub) => unsub())
  }, [uid])

  // Phone-switch requests: only the GM acts on them.
  const gmUid = game?.gmUid
  useEffect(() => {
    if (!uid || gmUid !== uid) {
      setReclaims([])
      return undefined
    }
    return onSnapshot(collection(db, 'games', GAME_ID, 'reclaims'), (snap) =>
      setReclaims(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    )
  }, [uid, gmUid])

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
  let tabs = null
  if (!isConfigured) {
    screen = <SetupNotice />
  } else if (authError) {
    screen = <AuthErrorScreen error={authError} />
  } else if (!uid || me === undefined || game === undefined) {
    screen = <LoadingScreen />
  } else if (!me) {
    screen = <JoinScreen uid={uid} game={game} players={players} />
  } else if (game?.status === 'active') {
    if (me.status === 'alive' && me.pendingKillFrom) {
      screen = (
        <DeathConfirmScreen me={me} players={players} onNotice={setNotice} />
      )
    } else if (me.status !== 'alive' && !isGM) {
      screen = <DeadScreen me={me} players={players} events={events} />
    } else {
      // Alive players get DOSSIER/FEED; the GM gets a third tab (and keeps
      // the panel even if they die — the organiser's word outlives them).
      const tabDefs = [
        { key: 'main', label: me.status === 'alive' ? 'DOSSIER' : 'GRAVE' },
        { key: 'feed', label: 'FEED' },
        ...(isGM ? [{ key: 'gm', label: 'GM' }] : []),
      ]
      tabs = (
        <nav className="tab-bar">
          {tabDefs.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`tab ${tab === t.key ? 'active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      )
      if (tab === 'feed') {
        screen = <FeedScreen players={players} events={events} />
      } else if (tab === 'gm' && isGM) {
        screen = (
          <GMScreen uid={uid} me={me} players={players} reclaims={reclaims} />
        )
      } else if (me.status === 'alive') {
        screen = (
          <MissionScreen uid={uid} me={me} mission={mission} players={players} />
        )
      } else {
        screen = <DeadScreen me={me} players={players} events={events} />
      }
    }
  } else if (game?.status === 'finished') {
    screen = (
      <WinnerScreen
        me={me}
        game={game}
        players={players}
        events={events}
        isGM={isGM}
      />
    )
  } else {
    screen = (
      <LobbyScreen me={me} isGM={isGM} players={players} reclaims={reclaims} />
    )
  }

  return (
    <>
      <div className="banners">
        <OfflineBanner />
        {notice && (
          <div className="notice-banner mono" role="status">
            <span>{notice}</span>
            <button
              type="button"
              className="notice-dismiss"
              onClick={() => setNotice(null)}
            >
              ✕
            </button>
          </div>
        )}
      </div>
      <div className={tabs ? 'with-tabs' : undefined}>{screen}</div>
      {tabs}
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
