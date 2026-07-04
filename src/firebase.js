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
  // Persistent local cache: reads keep working and plain writes queue while
  // offline. Transactions (join/start/kill) still need a live connection —
  // the offline banner in App.jsx manages expectations in basement bars.
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  })
}

export { auth, db }

// Signs in anonymously (once) and reports the stable UID. The UID persists in
// the browser, so a refresh or reopen lands the player back on their screen.
// onError surfaces failures (e.g. Anonymous Auth not enabled in the console,
// or no network on first load) so users don't sit on a spinner forever.
export function ensureSignedIn(onUser, onError) {
  return onAuthStateChanged(auth, (user) => {
    if (user) {
      onUser(user)
    } else {
      signInAnonymously(auth).catch((err) => {
        console.error('Anonymous sign-in failed', err)
        if (onError) onError(err)
      })
    }
  })
}
