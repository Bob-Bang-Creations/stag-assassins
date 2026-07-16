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
// refilled when exhausted. Trim or add lines freely before Friday — no
// other change needed. Some are found on the night (bottle cap, straw,
// cork), some come from a pound shop / party-bag aisle beforehand (duck,
// dinosaur, googly eye) — assassins supply their own weapons.
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
  'a bottle cap',
  'a drinking straw',
  'a sugar sachet',
  'a wine cork',
  'a poker chip',
  'a single dice',
  'a stick of chewing gum',
  'a googly eye',
  'a small toy dinosaur',
]

// Locations: zones that exist on any night out, so no mission goes stale
// as the crawl moves on. The first eight exist inside literally any venue;
// the rest exist across the night (street, takeaway, cash machine) or in
// almost every venue — if one ever goes stale, the GM reroll fixes it.
// Trim or add lines freely before Friday.
export const LOCATIONS = [
  'at the bar',
  'in the smoking area',
  'seated at a table',
  'outside the front entrance',
  'on the dancefloor or by the music',
  'in the beer garden or outdoor area',
  'while standing in any queue',
  'by the door',
  'on the way to or from the toilets',
  'while leaning against a wall',
  'by a window',
  'while walking between venues',
  'in a takeaway, kebab or chip shop',
  'at or by a cash machine',
  'within sight of the stag',
  'at a high table or leaning on a ledge',
  'by the pool table, darts or fruit machine',
  'within earshot of the bouncer',
  'under a TV or screen',
  'on or by the stairs',
]
