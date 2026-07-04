import { useEffect, useState } from 'react'
import { reportKill, verifyPin } from '../game'

// The heart of the app: a PIN-gated dossier. Locks itself again whenever the
// page is hidden (pocket, app switch, mate grabbing the phone mid-pint).
export default function MissionScreen({ uid, me, mission, players, checkPin }) {
  const [unlocked, setUnlocked] = useState(false)
  const [pin, setPin] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    function relock() {
      if (document.hidden) {
        setUnlocked(false)
        setPin('')
      }
    }
    document.addEventListener('visibilitychange', relock)
    return () => document.removeEventListener('visibilitychange', relock)
  }, [])

  const aliveCount = players.filter((p) => p.status === 'alive').length
  const target = mission
    ? players.find((p) => p.id === mission.targetId)
    : null
  // Our report is pending until the target confirms (their doc carries the
  // flag, and everyone can read player docs).
  const awaitingConfirm = Boolean(target && target.pendingKillFrom === uid)
  const [reportError, setReportError] = useState(null)
  const [reporting, setReporting] = useState(false)

  async function handleReportKill() {
    if (
      !window.confirm(
        `Report the kill on ${target.name}? Only report once their hand has closed on ${mission.object} ${mission.location}.`,
      )
    ) {
      return
    }
    setReportError(null)
    setReporting(true)
    try {
      await reportKill({
        assassinUid: uid,
        targetId: target.id,
        object: mission.object,
        location: mission.location,
      })
      // Their phone now shows the confirm screen; ours shows "awaiting".
    } catch (err) {
      setReportError(err.message)
    }
    setReporting(false)
  }

  async function handleUnseal() {
    setError(null)
    setBusy(true)
    try {
      const ok = await (checkPin ? checkPin(pin) : verifyPin(uid, pin))
      if (ok) {
        setUnlocked(true)
        setPin('')
      } else {
        setError('Wrong PIN. This dossier stays sealed.')
      }
    } catch {
      setError('No signal — try again when you reconnect.')
    }
    setBusy(false)
  }

  if (!mission) {
    return (
      <div className="screen centered">
        <p className="mono dim">Decrypting your dossier…</p>
      </div>
    )
  }

  if (!unlocked) {
    return (
      <div className="screen centered">
        <div className="dossier-card mission-card sealed">
          <p className="classified-stamp">CLASSIFIED</p>
          <p className="field-label centered-text">DOSSIER SEALED · AGENT {me.name?.toUpperCase()}</p>
          <label className="field-label" htmlFor="unseal-pin">ENTER PIN</label>
          <input
            id="unseal-pin"
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
            disabled={!/^\d{4}$/.test(pin) || busy}
            onClick={handleUnseal}
          >
            {busy ? 'CHECKING…' : 'UNSEAL'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      <div className="dossier-card mission-card open">
        <p className="field-label centered-text">TOP SECRET · EYES ONLY</p>

        {aliveCount === 2 && (
          <p className="final-two mono">
            It's down to you two. They're hunting you as well.
          </p>
        )}

        <div className="mission-row">
          <p className="mission-label">TARGET</p>
          <p className="mission-value target-name">
            <span className="redact">{target ? target.name : 'UNKNOWN'}</span>
          </p>
        </div>
        <div className="mission-row">
          <p className="mission-label">WEAPON</p>
          <p className="mission-value">
            <span className="redact">{mission.object}</span>
          </p>
        </div>
        <div className="mission-row">
          <p className="mission-label">LOCATION</p>
          <p className="mission-value">
            <span className="redact">{mission.location}</span>
          </p>
        </div>

        <p className="hint mono dim">
          The kill counts the moment their hand closes on the object, both of
          you at the location. Refusal is no kill.
        </p>

        {awaitingConfirm && (
          <p className="final-two mono">
            Kill reported. Waiting for {target?.name} to confirm on their
            phone. If theirs is dead (the phone), get the Game Master.
          </p>
        )}
        {target && target.status !== 'alive' && (
          <p className="hint mono dim">
            Your target is already dead. A new mission is on its way.
          </p>
        )}
        {reportError && <p className="error mono">{reportError}</p>}
        <button
          type="button"
          className="primary-btn"
          disabled={
            !target || target.status !== 'alive' || awaitingConfirm || reporting
          }
          onClick={handleReportKill}
        >
          {awaitingConfirm
            ? 'AWAITING CONFIRMATION'
            : reporting
              ? 'REPORTING…'
              : 'REPORT KILL'}
        </button>
        <button
          type="button"
          className="ghost-btn"
          onClick={() => setUnlocked(false)}
        >
          CONCEAL DOSSIER
        </button>
        <p className="hint mono dim centered-text">
          Mission dispute or impossible ask? Take it to the Game Master.
        </p>
      </div>
    </div>
  )
}
