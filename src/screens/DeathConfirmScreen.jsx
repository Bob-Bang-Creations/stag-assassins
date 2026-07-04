import { useState } from 'react'
import { confirmDeath, disputeKill, verifyPin } from '../game'

// The victim's phone flips here the moment their assassin reports the kill.
// Victim-driven by design: assassins have every incentive to lie. Confirming
// is the game's one irreversible action, so it is PIN-gated — the assassin
// (or anyone else) holding this phone must not be able to kill its owner.
// Dispute stays open: the worst a phone-grabber can do with it is summon
// the GM.
export default function DeathConfirmScreen({
  me,
  players,
  onConfirm,
  onDispute,
  checkPin,
  onNotice,
}) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const killer = players.find((p) => p.id === me.pendingKillFrom)
  const killerName = killer ? killer.name : 'Your assassin'

  async function handleConfirm() {
    setError(null)
    setBusy(true)
    try {
      const pinOk = await (checkPin ? checkPin(pin) : verifyPin(me.id, pin))
      if (!pinOk) {
        setError('Wrong PIN. Only the deceased may confirm their own death.')
        setBusy(false)
        return
      }
      const outcome = await (onConfirm
        ? onConfirm()
        : confirmDeath({ victimUid: me.id }))
      if (outcome === 'assassin_dead' && onNotice) {
        // Surfaced at App level: this screen unmounts the moment the
        // pending flag clears.
        onNotice(
          'Tangled kill: your assassin was eliminated first, so this one ' +
            "couldn't stand. Find the Game Master.",
        )
      }
      // Otherwise your player doc flips to dead and App reroutes.
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  async function handleDispute() {
    setError(null)
    setBusy(true)
    try {
      await (onDispute
        ? onDispute()
        : disputeKill({ victimUid: me.id, victimName: me.name }))
      // pendingKillFrom clears and App reroutes back to the mission card.
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="screen centered">
      <div className="dossier-card mission-card death-card">
        <p className="classified-stamp">KILL REPORT</p>
        <p className="death-question">CONFIRM YOUR DEATH?</p>
        <p className="mono">
          {killerName} reports eliminating you{' '}
          {me.pendingKillLocation ?? 'somewhere'} with{' '}
          {me.pendingKillObject ?? 'something'}.
        </p>
        <p className="hint mono dim">
          It counts if your hand closed on the object at that location. If it
          didn't happen like that, dispute it.
        </p>

        <label className="field-label" htmlFor="death-pin">
          YOUR PIN TO CONFIRM
        </label>
        <input
          id="death-pin"
          className="big-input mono pin-mask"
          type="text"
          inputMode="numeric"
          maxLength={4}
          autoComplete="off"
          placeholder="0000"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
        />

        {error && <p className="error mono">{error}</p>}

        <button
          type="button"
          className="primary-btn"
          disabled={busy || !/^\d{4}$/.test(pin)}
          onClick={handleConfirm}
        >
          {busy ? '…' : "IT'S TRUE. I'M DEAD"}
        </button>
        <button
          type="button"
          className="ghost-btn"
          disabled={busy}
          onClick={handleDispute}
        >
          DISPUTE — GET THE GM
        </button>
      </div>
    </div>
  )
}
