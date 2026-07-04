// Game setup. Edit ROSTER and GM_NAME before the weekend.

export const GAME_ID = 'stag-manchester-2026'

// Shown on the QR card / group chat. Checked at join AND enforced by
// firestore.rules — if you change it here, change codeOk() in
// firestore.rules to match and republish the rules.
export const JOIN_CODE = 'STAG18'

// Players pick their name from this list at join — no typos, no duplicates.
export const ROSTER = [
  'Bob',
  'Alex',
  'Liam',
  'Matt',
  'Joe',
  'Jonty',
  'Lewis',
  'Ollie',
  'Ryan',
  'Sam',
  'Thomas',
]

// The roster name that gets the GM tools (Start button, GM panel).
export const GM_NAME = 'Bob'

// Objects: pocketable, pub-safe, cheap. Assigned without replacement,
// refilled when exhausted.
export const OBJECTS = [
  'a beer mat',
  'a lemon slice',
  'a ketchup sachet',
  'a playing card',
  'a 1p coin',
  'a teabag',
  'a cocktail umbrella',
  'a Monopoly note',
  'a party ring biscuit',
  'a rubber duck',
  'a birthday candle',
]

// Locations: venue-agnostic zones that exist in any pub or club, so no
// mission can go stale as the crawl moves on.
export const LOCATIONS = [
  'at the bar',
  'in the smoking area',
  'seated at a table',
  'outside the front entrance',
  'on the dancefloor or by the music',
  'in the beer garden or outdoor area',
  'while standing in any queue',
  'by the door',
]
