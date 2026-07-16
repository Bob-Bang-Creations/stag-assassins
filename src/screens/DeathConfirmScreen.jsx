import { useState } from 'react'
import ArmedButton from '../components/ArmedButton'
import { confirmDeath, disputeKill } from '../game'

// The victim's phone flips here the moment their assassin reports the kill.
// Victim-driven by design: assassins have every incentive to lie, victims
// none. Confirming is irreversible, so it takes a deliberate second tap
// (tap-again to arm) to guard against a fat-fingered self-elimination.
export default function DeathConfirmScreen({
  me,
  players,
  onConfirm,
  onDispute,
  onNotice,
}) {
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const killer = players.find((p) => p.id === me.pendingKillFrom)
  const killerName = killer ? killer.name : 'Your assassin'

  async function handleConfirm() {
    setError(null)
    setBusy(true)
    try {
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

        {error && <p className="error mono">{error}</p>}

        <ArmedButton
          className="primary-btn"
          disabled={busy}
          label={busy ? '…' : "IT'S TRUE. I'M DEAD"}
          armedLabel="SURE? TAP AGAIN TO DIE"
          onFire={handleConfirm}
        />
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
