import { initializeApp } from 'firebase/app'
import { getAuth, onAuthStateChanged, signInAnonymously } from 'firebase/auth'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'
import { firebaseConfig } from './firebaseConfig'

export const isConfigured = !String(firebaseConfig.apiKey).startsWith('PASTE_')

let auth = null
let db = null

if (isConfigured) {
  const app = initializeApp(firebaseConfig)
  auth = getAuth(app)
  // Persistent local cache: writes queue offline and sync on reconnect,
  // which is what keeps the game alive in a basement bar.
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  })
}

export { auth, db }

// Signs in anonymously (once) and reports the stable UID. The UID persists in
// the browser, so a refresh or reopen lands the player back on their screen.
export function ensureSignedIn(onUser) {
  return onAuthStateChanged(auth, (user) => {
    if (user) {
      onUser(user)
    } else {
      signInAnonymously(auth).catch((err) => {
        console.error('Anonymous sign-in failed', err)
      })
    }
  })
}
