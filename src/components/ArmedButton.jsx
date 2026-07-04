import { useEffect, useRef, useState } from 'react'

// Two-tap confirmation without window.confirm: native dialogs have a
// history of silently no-oping in iOS standalone (Add to Home Screen)
// mode, and every destructive action here runs on a phone in a dark pub.
// First tap arms the button and shows the consequence; second tap within
// the window fires; it disarms itself after a few seconds.
export default function ArmedButton({
  className = 'primary-btn',
  disabled = false,
  requireArm = true,
  label,
  armedLabel,
  onFire,
}) {
  const [armed, setArmed] = useState(false)
  const timer = useRef(null)

  useEffect(() => () => clearTimeout(timer.current), [])
  useEffect(() => {
    if (disabled) setArmed(false)
  }, [disabled])

  function handleClick() {
    if (!requireArm || armed) {
      clearTimeout(timer.current)
      setArmed(false)
      onFire()
      return
    }
    setArmed(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setArmed(false), 4000)
  }

  return (
    <button
      type="button"
      className={`${className} ${armed ? 'armed' : ''}`}
      disabled={disabled}
      onClick={handleClick}
    >
      {armed ? armedLabel : label}
    </button>
  )
}
