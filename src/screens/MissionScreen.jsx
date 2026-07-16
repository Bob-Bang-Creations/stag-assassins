import { useState } from 'react'
import ArmedButton from '../components/ArmedButton'
import { reportKill } from '../game'

// The heart of the app: a dossier you HOLD to reveal. Nothing is shown until
// a finger is pressed on the reveal pad, and it re-hides the instant you let
// go — so a glance over your shoulder (or letting go to put the phone down)
// keeps your target secret. No PIN to forget in a dark pub.
export default function MissionScreen({ uid, me, mission, players }) {
  const [revealed, setRevealed] = useState(false)
  const [reportError, setReportError] = useState(null)
  const [reporting, setReporting] = useState(false)

  const aliveCount = players.filter((p) => p.status === 'alive').length
  const target = mission
    ? players.find((p) => p.id === mission.targetId)
    : null
  // Our report is pending until the target confirms (their doc carries the
  // flag, and everyone can read player docs).
  const awaitingConfirm = Boolean(target && target.pendingKillFrom === uid)

  async function handleReportKill() {
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

  if (!mission) {
    return (
      <div className="screen centered">
        <p className="mono dim">Decrypting your dossier…</p>
      </div>
    )
  }

  const hide = () => setRevealed(false)

  return (
    <div className="screen">
      <div
        className={`dossier-card mission-card no-select ${revealed ? 'open' : ''}`}
        onContextMenu={(e) => e.preventDefault()}
      >
        <p className="field-label centered-text">
          {revealed ? 'TOP SECRET · EYES ONLY' : `AGENT ${me.name?.toUpperCase()} · DOSSIER`}
        </p>

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

        <button
          type="button"
          className={`hold-btn ${revealed ? 'holding' : ''}`}
          onPointerDown={() => setRevealed(true)}
          onPointerUp={hide}
          onPointerLeave={hide}
          onPointerCancel={hide}
        >
          {revealed ? 'RELEASE TO HIDE' : 'HOLD TO REVEAL BRIEF'}
        </button>

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
        <ArmedButton
          className="primary-btn"
          disabled={
            !target || target.status !== 'alive' || awaitingConfirm || reporting
          }
          label={
            awaitingConfirm
              ? 'AWAITING CONFIRMATION'
              : reporting
                ? 'REPORTING…'
                : 'REPORT KILL'
          }
          armedLabel="HAND CLOSED ON OBJECT? TAP AGAIN"
          onFire={handleReportKill}
        />
        <p className="hint mono dim centered-text">
          Mission dispute or impossible ask? Take it to the Game Master.
        </p>
      </div>
    </div>
  )
}
