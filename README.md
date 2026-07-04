# Stag Assassins

Mobile web app for a live assassins game — 11 players, one night, Manchester,
Saturday 18 July 2026. Static frontend (Vite + React), Firebase Firestore +
Anonymous Auth as the shared backend. See `PLAN.md`-style details in the
development plan document.

## Firebase setup (one-time, free — Spark plan only)

Everything runs on the **Spark plan, which is permanently free and needs no
credit card**. Do **not** enable Blaze or add billing at any point; nothing in
this app needs it.

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and
   create a project (e.g. `stag-assassins`). Decline Google Analytics.
2. **Firestore:** Build → Firestore Database → Create database → production
   mode → a European region (e.g. `europe-west2`, London).
3. **Rules:** Firestore → Rules tab → paste the contents of
   [`firestore.rules`](firestore.rules) → Publish.
4. **Anonymous Auth:** Build → Authentication → Get started → Sign-in method →
   Anonymous → Enable.
5. **Web app config:** Project settings (gear icon) → Your apps → Web (`</>`)
   → register the app (no hosting needed) → copy the `firebaseConfig` object
   into [`src/firebaseConfig.js`](src/firebaseConfig.js). This config is not a
   secret; it's safe to commit.

## Game setup

Edit [`src/gameConfig.js`](src/gameConfig.js):

- `ROSTER` — the real 11 names (players pick from this list at join)
- `GM_NAME` — which roster name gets the Game Master tools
- `JOIN_CODE` — the code on the QR card / group chat

## Run locally

```bash
npm install
npm run dev
```

Open the printed URL. To simulate several players, use separate browser
profiles or private windows (each gets its own anonymous identity — but warn
the real group **not** to use private browsing on the night, it resets their
identity on close).

## Security model (short version)

- The join code is enforced in `firestore.rules`, not just the client — a
  stranger who finds the URL can read the feed but can't write anything.
  If you change `JOIN_CODE` in `src/gameConfig.js`, update `codeOk()` in
  `firestore.rules` and republish.
- Mission secrets and PINs live in each player's `private/` subcollection,
  readable only by that player and the GM.
- The GM role (`gmUid` on the game doc) can be set once, only to yourself,
  never changed — it can't be seized from a browser console.
- Transactions (join, start, kill handshake) need signal; plain reads and
  the feed keep working offline. The app shows a NO SIGNAL banner.
- If someone switches phones or clears their browser data, they request a
  re-link from the join screen and the GM approves it from the panel (verify
  it's really them in person — the app can't).
- Two break-glass caveats for the organiser: the GM identity itself cannot
  be re-linked in-app (the GM lock is deliberately permanent — keep that
  phone alive, or edit `gmUid` on the game doc in the Firebase console),
  and if the GM is a victim whose own phone dies, nobody can force-confirm
  that kill (the GM should die honestly).

## Build stages

Implemented in order, per the development plan:

1. ✅ Join and lobby
2. ✅ Ring shuffle on start
3. ✅ Mission card
4. ✅ Kill handshake transaction
5. ✅ Kill feed, graveyard, dead spectator view, winner screen
6. ✅ GM panel (force-confirm, remove player, reroll, end game, pressure
   taunt, phone re-link recovery)
7. ✅ PWA (manifest, icons, Add to Home Screen) + GitHub Pages deploy

## Deploy

Merge to `main` and the deploy workflow publishes to GitHub Pages
(one-time: repo Settings → Pages → Source → "GitHub Actions"). The app URL
will be `https://<owner>.github.io/stag-assassins/` — generate a QR code
for it and drop it in the group chat on the Friday.
