import { useState } from 'react'
import { gmResetGame } from '../game'

// GM-only nuclear option, available from the lobby, the GM panel and the
// game-over screen. Guarded by typing RESET so it can't happen on a
// mis-tap in a dark pub. On success the game doc flips to lobby and every
// phone (the GM's included) reroutes to the join screen.
export default function ResetGamePanel() {
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const armed = confirm.trim().toUpperCase() === 'RESET'

  async function handleReset() {
    if (!armed) return
    setError(null)
    setBusy(true)
    try {
      await gmResetGame()
      // Snapshots do the rest: status → lobby, players gone, all phones
      // land back on Join.
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <section className="dossier-card reset-card">
      <p className="field-label danger-label">DANGER · RESET THE GAME</p>
      <p className="hint mono dim">
        Wipes every player, mission, PIN, death and the feed, and returns to
        an empty lobby. Everyone re-joins from scratch. Cannot be undone.
      </p>
      <label className="field-label" htmlFor="reset-confirm">
        TYPE RESET TO CONFIRM
      </label>
      <input
        id="reset-confirm"
        className="big-input mono"
        type="text"
        autoCapitalize="characters"
        autoComplete="off"
        placeholder="RESET"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
      />
      {error && <p className="error mono">{error}</p>}
      <button
        type="button"
        className="primary-btn"
        disabled={!armed || busy}
        onClick={handleReset}
      >
        {busy ? 'RESETTING…' : 'WIPE AND RESET'}
      </button>
    </section>
  )
}
