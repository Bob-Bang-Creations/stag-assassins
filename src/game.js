// All game actions live here. Everything is client-side Firestore; the
// transactions are what make simultaneous actions safe.
import {
  addDoc,
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase'
import { GAME_ID, GM_NAME, JOIN_CODE } from './gameConfig'

export const gameRef = () => doc(db, 'games', GAME_ID)
export const playerRef = (uid) => doc(db, 'games', GAME_ID, 'players', uid)
export const missionRef = (uid) =>
  doc(db, 'games', GAME_ID, 'players', uid, 'private', 'mission')
export const nameRef = (name) => doc(db, 'games', GAME_ID, 'names', name)
export const eventsCol = () => collection(db, 'games', GAME_ID, 'events')

export async function postEvent(type, text) {
  await addDoc(eventsCol(), { type, text, at: serverTimestamp() })
}

// Join: claim a roster name and create the player doc. Runs in a transaction
// so two phones grabbing the same name at once can't both win — the name
// claim doc (id = the name itself) is the lock.
export async function joinGame({ uid, name, pin, code }) {
  if (code.trim().toUpperCase() !== JOIN_CODE) {
    throw new Error('Wrong join code. Check the card.')
  }
  await runTransaction(db, async (tx) => {
    const nameSnap = await tx.get(nameRef(name))
    if (nameSnap.exists() && nameSnap.data().uid !== uid) {
      throw new Error(`${name} is already taken. Are you sure that's you?`)
    }
    const gameSnap = await tx.get(gameRef())
    if (!gameSnap.exists()) {
      // First player in creates the game doc in lobby state.
      tx.set(gameRef(), {
        status: 'lobby',
        joinCode: JOIN_CODE,
        endsAt: null,
        winnerId: null,
        createdAt: serverTimestamp(),
      })
    } else if (gameSnap.data().status !== 'lobby') {
      throw new Error('The game has already started.')
    }
    tx.set(nameRef(name), { uid })
    tx.set(playerRef(uid), {
      name,
      pin,
      status: 'alive',
      kills: 0,
      killedBy: null,
      diedAt: null,
      isGM: name === GM_NAME,
      joinedAt: serverTimestamp(),
    })
    if (name === GM_NAME) {
      // gmUid on the game doc powers the GM-read rule on mission docs.
      tx.set(gameRef(), { gmUid: uid }, { merge: true })
    }
  })
  await postEvent('join', `${name} has entered the game`)
}
