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
  deleteField,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'
import { GAME_ID, GM_NAME, JOIN_CODE, LOCATIONS, OBJECTS } from './gameConfig'

export const gameRef = () => doc(db, 'games', GAME_ID)
export const playerRef = (uid) => doc(db, 'games', GAME_ID, 'players', uid)
export const missionRef = (uid) =>
  doc(db, 'games', GAME_ID, 'players', uid, 'private', 'mission')
export const nameRef = (name) => doc(db, 'games', GAME_ID, 'names', name)
export const eventsCol = () => collection(db, 'games', GAME_ID, 'events')
export const reclaimRef = (uid) => doc(db, 'games', GAME_ID, 'reclaims', uid)

// Fire-and-forget: the feed is nice-to-have. Never let a failed feed write
// make a completed action look failed.
export function postEvent(type, text) {
  addDoc(eventsCol(), { type, text, at: serverTimestamp() }).catch((err) =>
    console.error('Feed write failed', err),
  )
}

// Fisher-Yates.
export function shuffled(list) {
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

function randomFrom(list) {
  return list[Math.floor(Math.random() * list.length)]
}

// Join: claim a roster name and create the player doc. Runs in a transaction
// so two phones grabbing the same name at once can't both win — the name
// claim doc (id = the name itself) is the lock.
export async function joinGame({ uid, name, code }) {
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
  })
  postEvent('join', `${name} has entered the game`)
}

// ---------------------------------------------------------------------------
// GM tools. All guarded by rules (isGM = the locked gmUid on the game doc).

// Recovery: a player on a new phone (dead battery, cleared Safari, private
// browsing) posts a reclaim request; the GM approves and their whole
// identity — player doc and mission — migrates to the new uid.
export async function requestReclaim({ uid, name, code }) {
  if (code.trim().toUpperCase() !== JOIN_CODE.toUpperCase()) {
    throw new Error('Wrong join code. Check the card.')
  }
  await setDoc(reclaimRef(uid), {
    name,
    joinCode: JOIN_CODE,
    at: serverTimestamp(),
  })
}

export async function gmApproveReclaim({ newUid, players = [], reclaims = [] }) {
  let migratedName = null
  await runTransaction(db, async (tx) => {
    migratedName = null
    // --- reads (all before the first write; the SDK requires it) ---
    const reclaimSnap = await tx.get(reclaimRef(newUid))
    if (!reclaimSnap.exists()) throw new Error('Request vanished.')
    const name = reclaimSnap.data().name
    const nameSnap = await tx.get(nameRef(name))
    if (!nameSnap.exists()) throw new Error(`No claim on ${name} to move.`)
    const oldUid = nameSnap.data().uid
    if (oldUid === newUid) {
      // Already linked — just clear the stale request (no feed line).
      tx.delete(reclaimRef(newUid))
      return
    }
    const gameSnap = await tx.get(gameRef())
    if (gameSnap.data()?.gmUid === oldUid) {
      throw new Error(
        "That's the GM identity — it can't move in-app (the GM lock is " +
          'deliberately permanent). Keep the old phone, or edit gmUid in ' +
          'the Firebase console as a last resort.',
      )
    }
    const newPlayerSnap = await tx.get(playerRef(newUid))
    if (newPlayerSnap.exists()) {
      throw new Error(
        `That phone is already in the game as ${newPlayerSnap.data().name}.`,
      )
    }
    const oldPlayerSnap = await tx.get(playerRef(oldUid))
    if (!oldPlayerSnap.exists()) {
      throw new Error(`${name} has no player doc — have them join normally.`)
    }
    const oldMissionSnap = await tx.get(missionRef(oldUid))

    // Ring rewiring: whoever hunts the old uid must hunt the new one, and
    // an outstanding report BY the old uid must follow them too — otherwise
    // the hunter is left aiming at a deleted doc (soft-locked out).
    const active = gameSnap.data()?.status === 'active'
    let hunterUid = null
    let staleReportTargetUid = null
    if (active) {
      const others = players.filter(
        (p) => p.status === 'alive' && p.id !== oldUid && p.id !== newUid,
      )
      const missionSnaps = await Promise.all(
        others.map((p) => tx.get(missionRef(p.id))),
      )
      // A just-killed player's stale mission can also point at oldUid (the
      // UI snapshot may lag), so re-verify alive status in-transaction and
      // never rewire a corpse instead of the live hunter.
      const candidates = others.filter(
        (p, i) =>
          missionSnaps[i].exists() && missionSnaps[i].data().targetId === oldUid,
      )
      const candidateSnaps = await Promise.all(
        candidates.map((p) => tx.get(playerRef(p.id))),
      )
      candidateSnaps.forEach((snap, i) => {
        if (snap.data()?.status === 'alive') hunterUid = candidates[i].id
      })
      const oldTargetId = oldMissionSnap.data()?.targetId
      if (oldTargetId && oldTargetId !== newUid) {
        const targetSnap = await tx.get(playerRef(oldTargetId))
        if (targetSnap.data()?.pendingKillFrom === oldUid) {
          staleReportTargetUid = oldTargetId
        }
      }
    }

    // --- writes ---
    tx.set(playerRef(newUid), oldPlayerSnap.data())
    if (oldMissionSnap.exists()) tx.set(missionRef(newUid), oldMissionSnap.data())
    if (hunterUid) {
      tx.set(missionRef(hunterUid), { targetId: newUid }, { merge: true })
    }
    if (staleReportTargetUid) {
      tx.update(playerRef(staleReportTargetUid), { pendingKillFrom: newUid })
    }
    tx.update(nameRef(name), { uid: newUid })
    tx.delete(missionRef(oldUid))
    tx.delete(playerRef(oldUid))
    tx.delete(reclaimRef(newUid))
    // Clear duplicate requests for the same name so a stale one can't be
    // approved later and migrate the identity again.
    reclaims
      .filter((r) => r.name === name && r.id !== newUid)
      .forEach((r) => tx.delete(reclaimRef(r.id)))
    migratedName = name
  })
  if (migratedName) {
    postEvent(
      'gm_action',
      `${migratedName} has switched phones — re-linked by the GM.`,
    )
  }
}

// Remove a player who went home / stopped playing. The ring heals itself:
// their assassin inherits their target (keeping the assassin's current
// object and location). assassinUid comes from the GM's ring view and is
// re-verified inside the transaction.
export async function gmRemovePlayer({ removedUid, assassinUid }) {
  let outcome = null
  let feedLines = []
  await runTransaction(db, async (tx) => {
    outcome = null
    feedLines = []
    const gameSnap = await tx.get(gameRef())
    if (gameSnap.data()?.status !== 'active') {
      throw new Error('The game is not live.')
    }
    const removedSnap = await tx.get(playerRef(removedUid))
    const removed = removedSnap.data()
    if (!removed || removed.status !== 'alive') {
      throw new Error('Already out of the game.')
    }
    const assassinMissionSnap = await tx.get(missionRef(assassinUid))
    if (assassinMissionSnap.data()?.targetId !== removedUid) {
      throw new Error('The ring has shifted — reopen the panel and retry.')
    }
    const assassinSnap = await tx.get(playerRef(assassinUid))
    const assassin = assassinSnap.data()
    if (!assassin || assassin.status !== 'alive') {
      throw new Error('Their assassin is dead — the ring has shifted. Retry.')
    }
    const removedMissionSnap = await tx.get(missionRef(removedUid))
    const inheritedTargetId = removedMissionSnap.data()?.targetId ?? null
    if (!inheritedTargetId) {
      // A missing mission must never be mistaken for ring closure (that
      // would be an instant premature win) — same guard as confirmDeath.
      throw new Error(
        `No mission on file for ${removed.name} — adjudicate by hand.`,
      )
    }
    // If the removed player had a live report out on their own target,
    // clear it — the reporter is leaving the game.
    let staleReportTarget = null
    if (inheritedTargetId && inheritedTargetId !== assassinUid) {
      const targetSnap = await tx.get(playerRef(inheritedTargetId))
      if (targetSnap.data()?.pendingKillFrom === removedUid) {
        staleReportTarget = inheritedTargetId
      }
    }

    tx.update(playerRef(removedUid), {
      status: 'dead',
      fled: true,
      killedBy: null,
      diedAt: serverTimestamp(),
      diedWhere: null,
      diedWith: null,
      pendingKillFrom: null,
      pendingKillObject: null,
      pendingKillLocation: null,
      pendingKillAt: null,
    })
    if (staleReportTarget) {
      tx.update(playerRef(staleReportTarget), {
        pendingKillFrom: null,
        pendingKillObject: null,
        pendingKillLocation: null,
        pendingKillAt: null,
      })
    }
    feedLines = [['gm_action', `${removed.name} has fled the city.`]]
    if (inheritedTargetId === assassinUid) {
      tx.update(gameRef(), { status: 'finished', winnerId: assassinUid })
      outcome = 'won'
      feedLines.push(['win', `${assassin.name} is the last assassin standing.`])
    } else {
      tx.set(
        missionRef(assassinUid),
        { targetId: inheritedTargetId, assignedAt: serverTimestamp() },
        { merge: true },
      )
      outcome = 'removed'
    }
  })
  feedLines.forEach(([type, text]) => postEvent(type, text))
  return outcome
}

// Reroll a struggling player's object and/or location (target unchanged).
export async function gmRerollMission({ playerUid, playerName }) {
  await runTransaction(db, async (tx) => {
    const missionSnap = await tx.get(missionRef(playerUid))
    if (!missionSnap.exists()) throw new Error('No mission to reroll.')
    tx.set(
      missionRef(playerUid),
      {
        object: randomFrom(OBJECTS),
        location: randomFrom(LOCATIONS),
        assignedAt: serverTimestamp(),
      },
      { merge: true },
    )
  })
  postEvent('gm_action', `Fresh orders issued to ${playerName}.`)
}

// The whistle: end the game and crown the survivor with the most kills
// (GM picks — the app pre-sorts, the GM's word is final).
export async function gmEndGame({ winnerUid, winnerName }) {
  await runTransaction(db, async (tx) => {
    const gameSnap = await tx.get(gameRef())
    if (gameSnap.data()?.status !== 'active') {
      throw new Error('The game is not live.')
    }
    tx.update(gameRef(), { status: 'finished', winnerId: winnerUid })
  })
  postEvent('win', `Full time. ${winnerName} takes it.`)
}

// Feed taunt to shake a stalled game loose.
export function gmPressure(names) {
  postEvent(
    'gm_action',
    `The city grows restless. All eyes on ${names.join(' and ')}.`,
  )
}

// Full reset (GM only): wipe every player, mission, name claim,
// reclaim request and the feed, and return to an empty lobby. Everyone
// re-joins from scratch. The game doc itself survives (it can't be deleted,
// and its gmUid lock is permanent) — status flips back to lobby and the
// player count resets to zero.
//
// Not a transaction: it's a deliberate, confirmed, single-operator action
// with no race to guard against, and it spans more docs than one
// transaction should. Deletes are chunked into batches (Firestore caps a
// batch at 500 writes). The feed is cleared best-effort: clearing events
// needs the events `delete` rule (added in firestore.rules) — if that rule
// hasn't been re-published yet, the reset still completes and just leaves
// the old feed behind.
export async function gmResetGame() {
  const [playersSnap, namesSnap, reclaimsSnap] = await Promise.all([
    getDocs(collection(db, 'games', GAME_ID, 'players')),
    getDocs(collection(db, 'games', GAME_ID, 'names')),
    getDocs(collection(db, 'games', GAME_ID, 'reclaims')),
  ])

  const refs = []
  playersSnap.forEach((d) => {
    refs.push(missionRef(d.id), playerRef(d.id))
  })
  namesSnap.forEach((d) => refs.push(nameRef(d.id)))
  reclaimsSnap.forEach((d) => refs.push(reclaimRef(d.id)))
  await commitDeletes(refs)

  // Feed: best-effort in its own batch so a not-yet-published delete rule
  // can't fail the whole reset.
  try {
    const eventsSnap = await getDocs(eventsCol())
    await commitDeletes(eventsSnap.docs.map((d) => d.ref))
  } catch (err) {
    console.warn('Feed not cleared (publish the events delete rule):', err)
  }

  // Back to a fresh, empty lobby, and RELEASE the GM role: a reset means a
  // new game, so whoever next joins as GM_NAME claims GM — it's no longer
  // welded to whichever device first joined as Bob. Clearing gmUid needs the
  // relaxed gmUnchanged() rule; if the rules haven't been re-published yet,
  // fall back to a reset that keeps gmUid so the game isn't left half-wiped.
  const base = { status: 'lobby', winnerId: null, playerCount: 0, endsAt: null }
  try {
    await updateDoc(gameRef(), { ...base, gmUid: deleteField() })
  } catch (err) {
    console.warn('GM role not released (re-publish firestore.rules):', err)
    await updateDoc(gameRef(), base)
  }
}

async function commitDeletes(refs) {
  for (let i = 0; i < refs.length; i += 400) {
    const batch = writeBatch(db)
    refs.slice(i, i + 400).forEach((ref) => batch.delete(ref))
    await batch.commit()
  }
}

// Spectator ring reveal: dead players (and anyone once the game finishes)
// may read every mission per the rules. Returns [{hunter, target, object,
// location}] for all alive players; misses resolve to null and are skipped.
export async function fetchRing(players) {
  const alive = players.filter((p) => p.status === 'alive')
  const snaps = await Promise.all(
    alive.map((p) => getDoc(missionRef(p.id)).catch(() => null)),
  )
  const byId = new Map(players.map((p) => [p.id, p]))
  return alive
    .map((p, i) => {
      const mission = snaps[i]?.exists() ? snaps[i].data() : null
      if (!mission) return null
      return {
        hunter: p,
        target: byId.get(mission.targetId) ?? null,
        object: mission.object,
        location: mission.location,
      }
    })
    .filter(Boolean)
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
    // A re-link approved seconds ago can leave the GM's snapshot listing a
    // deleted uid — never deal a mission to a ghost.
    const playerSnaps = await Promise.all(
      players.map((p) => tx.get(playerRef(p.id))),
    )
    if (playerSnaps.some((snap) => !snap.exists())) {
      throw new Error(
        'The roster shifted a moment ago — check the lobby and start again.',
      )
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

// Kill handshake, step 1 (assassin): flag the target's player doc. Their
// phone is already listening and flips to the confirm screen. The object
// and location ride along so the victim's phone can write the feed line —
// it cannot read the assassin's mission doc. Transactional so a report
// can't land on a player who just died or a game that just ended (stale
// snapshots happen when two listeners deliver out of step).
export async function reportKill({ assassinUid, targetId, object, location }) {
  await runTransaction(db, async (tx) => {
    const gameSnap = await tx.get(gameRef())
    if (gameSnap.data()?.status !== 'active') {
      throw new Error('The game is not live.')
    }
    const targetSnap = await tx.get(playerRef(targetId))
    const target = targetSnap.data()
    if (!target || target.status !== 'alive') {
      throw new Error(
        'Your target is already dead. A new mission is on its way.',
      )
    }
    tx.update(playerRef(targetId), {
      pendingKillFrom: assassinUid,
      pendingKillObject: object,
      pendingKillLocation: location,
      pendingKillAt: serverTimestamp(),
    })
  })
}

// Kill handshake, step 2 (victim confirms — deliberately victim-driven:
// assassins have every incentive to lie, victims none). One transaction:
// victim dies, assassin scores and inherits the victim's target with a
// fresh object and location. If the inherited target IS the assassin, the
// ring has closed and they are the last one standing. Simultaneous kills
// serialise here: the second transaction retries against the new state.
//
// Returns 'died' | 'won' | 'assassin_dead' (kill can't stand, GM to
// adjudicate — that path clears the pending flag but changes nothing else).
export async function confirmDeath({ victimUid }) {
  let outcome = null
  let feed = []
  await runTransaction(db, async (tx) => {
    outcome = null
    feed = []
    // All reads first: the client SDK forbids reads after writes.
    const gameSnap = await tx.get(gameRef())
    if (gameSnap.data()?.status !== 'active') {
      throw new Error('The game is not live.')
    }
    const victimSnap = await tx.get(playerRef(victimUid))
    const victim = victimSnap.data()
    if (!victim || victim.status !== 'alive') {
      throw new Error("You're already dead.")
    }
    const assassinUid = victim.pendingKillFrom
    if (!assassinUid) {
      throw new Error('No pending kill to confirm.')
    }
    const assassinSnap = await tx.get(playerRef(assassinUid))
    const assassin = assassinSnap.data()
    const clearPending = {
      pendingKillFrom: null,
      pendingKillObject: null,
      pendingKillLocation: null,
      pendingKillAt: null,
    }
    if (!assassin || assassin.status !== 'alive') {
      // Assassin was eliminated between report and confirm. The kill can't
      // resolve cleanly (their own killer already inherited a target), so
      // clear the flag and send both to the GM.
      tx.update(playerRef(victimUid), clearPending)
      outcome = 'assassin_dead'
      feed = [
        ['gm_action', `${victim.name}'s elimination is tangled — the assassin fell first. Game Master to adjudicate.`],
      ]
      return
    }
    const victimMissionSnap = await tx.get(missionRef(victimUid))
    const inheritedTargetId = victimMissionSnap.data()?.targetId ?? null
    if (!inheritedTargetId) {
      // No mission on file (should never happen; a missing doc must NOT be
      // mistaken for ring closure — that would be an instant premature win).
      tx.update(playerRef(victimUid), clearPending)
      outcome = 'assassin_dead'
      feed = [
        ['gm_action', `${victim.name}'s elimination is tangled — no mission on file. Game Master to adjudicate.`],
      ]
      return
    }

    tx.update(playerRef(victimUid), {
      ...clearPending,
      status: 'dead',
      killedBy: assassinUid,
      diedAt: serverTimestamp(),
      // Preserved for the gravestone ("Taken at the bar with a teabag").
      diedWhere: victim.pendingKillLocation ?? null,
      diedWith: victim.pendingKillObject ?? null,
    })
    tx.update(playerRef(assassinUid), { kills: (assassin.kills ?? 0) + 1 })
    feed = [
      ['kill', `${victim.name} was eliminated ${victim.pendingKillLocation ?? 'somewhere'} with ${victim.pendingKillObject ?? 'something'}`],
    ]
    if (inheritedTargetId === assassinUid) {
      // Ring closed: the assassin inherits themselves. Last one standing.
      tx.update(gameRef(), { status: 'finished', winnerId: assassinUid })
      outcome = 'won'
      feed.push(['win', `${assassin.name} is the last assassin standing.`])
    } else {
      tx.set(missionRef(assassinUid), {
        targetId: inheritedTargetId,
        object: randomFrom(OBJECTS),
        location: randomFrom(LOCATIONS),
        assignedAt: serverTimestamp(),
      })
      outcome = 'died'
    }
  })
  feed.forEach(([type, text]) => postEvent(type, text))
  return outcome
}

// Kill handshake, dispute branch: clear the flag, point both at the GM.
// Transactional so a dispute racing a confirm can't post a misleading
// "disputes their elimination" line after the death already stood. The
// report showed the victim their assassin's object and location, so the
// assassin gets fresh ones — otherwise the victim could dodge that combo
// all night.
export async function disputeKill({ victimUid, victimName }) {
  let cleared = false
  await runTransaction(db, async (tx) => {
    cleared = false
    const victimSnap = await tx.get(playerRef(victimUid))
    const victim = victimSnap.data()
    if (!victim || victim.status !== 'alive' || !victim.pendingKillFrom) {
      return // nothing to dispute (already resolved)
    }
    tx.update(playerRef(victimUid), {
      pendingKillFrom: null,
      pendingKillObject: null,
      pendingKillLocation: null,
      pendingKillAt: null,
    })
    // No existence read first: the victim may WRITE the assassin's mission
    // (kill-handshake rule) but may not READ it — a tx.get here is
    // permission-denied and would brick the dispute button. The assassin
    // necessarily had a mission to report from, so merge blindly.
    tx.set(
      missionRef(victim.pendingKillFrom),
      {
        object: randomFrom(OBJECTS),
        location: randomFrom(LOCATIONS),
        assignedAt: serverTimestamp(),
      },
      { merge: true },
    )
    cleared = true
  })
  if (cleared) {
    postEvent(
      'gm_action',
      `${victimName} disputes their elimination — Game Master to adjudicate.`,
    )
  }
}
