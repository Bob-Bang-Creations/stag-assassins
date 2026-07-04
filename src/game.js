// All game actions live here. Everything is client-side Firestore; the
// transactions are what make simultaneous actions safe.
//
// Note on offline: plain writes queue while offline and sync on reconnect,
// but TRANSACTIONS (join, start, and later the kill handshake) need a live
// connection — they read the server before writing. The offline banner in
// App.jsx is there so people blame the signal, not the app.
import {
  addDoc,
  collection,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase'
import { GAME_ID, GM_NAME, JOIN_CODE, LOCATIONS, OBJECTS } from './gameConfig'

export const gameRef = () => doc(db, 'games', GAME_ID)
export const playerRef = (uid) => doc(db, 'games', GAME_ID, 'players', uid)
export const missionRef = (uid) =>
  doc(db, 'games', GAME_ID, 'players', uid, 'private', 'mission')
export const secretsRef = (uid) =>
  doc(db, 'games', GAME_ID, 'players', uid, 'private', 'secrets')
export const nameRef = (name) => doc(db, 'games', GAME_ID, 'names', name)
export const eventsCol = () => collection(db, 'games', GAME_ID, 'events')

// Fire-and-forget: the feed is nice-to-have. Never let a failed feed write
// make a completed action look failed.
export function postEvent(type, text) {
  addDoc(eventsCol(), { type, text, at: serverTimestamp() }).catch((err) =>
    console.error('Feed write failed', err),
  )
}

// Fisher-Yates.
function shuffled(list) {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

// n items drawn without replacement, reshuffling a fresh deck whenever one
// runs out (11 players, 8 locations: some repeat, none twice in a row-ish).
function deal(list, n) {
  const out = []
  while (out.length < n) out.push(...shuffled(list))
  return out.slice(0, n)
}

// Join: claim a roster name and create the player doc. Runs in a transaction
// so two phones grabbing the same name at once can't both win — the name
// claim doc (id = the name itself) is the lock.
export async function joinGame({ uid, name, pin, code }) {
  if (code.trim().toUpperCase() !== JOIN_CODE.toUpperCase()) {
    throw new Error('Wrong join code. Check the card.')
  }
  await runTransaction(db, async (tx) => {
    const nameSnap = await tx.get(nameRef(name))
    if (nameSnap.exists() && nameSnap.data().uid !== uid) {
      throw new Error(
        `${name} is already claimed on another phone. If that's really you ` +
          '(new phone? cleared Safari?), ask the Game Master to re-link you.',
      )
    }
    const gameSnap = await tx.get(gameRef())
    const rejoining = nameSnap.exists() // same uid re-claiming its own name
    // Exactly ONE write to the game doc per transaction: rules evaluate each
    // write against pre-transaction state, so a second same-doc write would
    // be judged as a create with only its own fields and fail codeOk.
    if (!gameSnap.exists()) {
      // First player in creates the game doc in lobby state. playerCount
      // lets the start transaction detect a join racing the shuffle. gmUid
      // (set once, to yourself only) powers the GM-read rule on missions.
      tx.set(gameRef(), {
        status: 'lobby',
        joinCode: JOIN_CODE,
        endsAt: null,
        winnerId: null,
        playerCount: 1,
        createdAt: serverTimestamp(),
        ...(name === GM_NAME ? { gmUid: uid } : {}),
      })
    } else if (gameSnap.data().status !== 'lobby') {
      throw new Error('The game has already started. Too late to join.')
    } else {
      const patch = {}
      if (!rejoining) {
        patch.playerCount = (gameSnap.data().playerCount ?? 0) + 1
      }
      if (name === GM_NAME && !gameSnap.data().gmUid) {
        patch.gmUid = uid
      }
      if (Object.keys(patch).length > 0) {
        tx.set(gameRef(), patch, { merge: true })
      }
    }
    // Only create the claim when absent: overwriting an existing claim is
    // an UPDATE, which rules reserve for the GM (re-link recovery tool) —
    // and after a GM re-link the claim already points at this uid.
    if (!nameSnap.exists()) {
      tx.set(nameRef(name), { uid, joinCode: JOIN_CODE })
    }
    tx.set(playerRef(uid), {
      name,
      joinCode: JOIN_CODE,
      status: 'alive',
      kills: 0,
      killedBy: null,
      diedAt: null,
      joinedAt: serverTimestamp(),
    })
    // PIN lives in private/, readable only by this player and the GM.
    tx.set(secretsRef(uid), { pin })
  })
  postEvent('join', `${name} has entered the game`)
}

// PIN gate for the mission card. A human-level lock, not crypto: it stops
// the mate who grabs an unlocked phone, not the mate with a debugger.
export async function verifyPin(uid, pin) {
  const snap = await getDoc(secretsRef(uid))
  return snap.exists() && snap.data().pin === pin
}

// Start: shuffle all players into a single ring (Hamiltonian cycle — each
// targets the next, last targets first), deal objects and locations, flip
// the game live. One transaction so every mission appears simultaneously.
export async function startGame({ players }) {
  await runTransaction(db, async (tx) => {
    const gameSnap = await tx.get(gameRef())
    if (!gameSnap.exists() || gameSnap.data().status !== 'lobby') {
      throw new Error('The game has already started.')
    }
    if ((gameSnap.data().playerCount ?? 0) !== players.length) {
      throw new Error(
        'Someone joined a moment ago. Check the lobby list and start again.',
      )
    }
    if (players.length < 2) {
      throw new Error('Need at least two assassins.')
    }
    const ring = shuffled(players.map((p) => p.id))
    const objects = deal(OBJECTS, ring.length)
    const locations = deal(LOCATIONS, ring.length)
    ring.forEach((uid, i) => {
      tx.set(missionRef(uid), {
        targetId: ring[(i + 1) % ring.length],
        object: objects[i],
        location: locations[i],
        assignedAt: serverTimestamp(),
      })
    })
    tx.update(gameRef(), { status: 'active', startedAt: serverTimestamp() })
  })
  postEvent('start', 'The game is afoot.')
}
