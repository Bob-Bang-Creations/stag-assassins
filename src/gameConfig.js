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
  'a coin',
  'a teabag',
  'a bottle cap',
  'a drinking straw',
  'a wine cork',
  'a stick of chewing gum',
  'a napkin',
  'a receipt',
  'a lighter',
  'a packet of crisps',
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
  'while standing in any queue',
  'on the way to or from the toilets',
  'while walking between venues',
  'by the stag',
  'at the hotel',
  'during a round of shots',
  'while the stag is away from the group',
]
