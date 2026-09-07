# Packliste

Personal PWA for trip packing prep and checklists. Replaces a Google Sheet workflow — see the spec in this repo's history/PR description for full details.

## Stack

- Vite + vanilla JavaScript (no framework, no TypeScript)
- Alpine.js for declarative UI binding
- Firebase Firestore (client SDK, offline persistence) + Firebase Auth (single fixed account)
- Deployed to GitHub Pages via GitHub Actions

## Project structure

```
src/
  lib/      shared helpers (firebase client, router, formatting, etc.)
  screens/  one module per screen (Home, Prep, Checklist, Settings)
  data/     seed data and data-access helpers
```

## Development

```
npm install
npm run dev       # local dev server
npm run build     # production build to dist/
npm run preview   # preview the production build locally
```

## Deployment

Pushes to `main` build and publish automatically to GitHub Pages via a GitHub Actions workflow (added in a later step). The app is served from the `/Packliste/` subpath.

## Firebase setup

This app reuses the existing **exercise-tracker** Firebase project, registered as its own Web app within that project, with its own Firestore database named `packliste` (kept separate from the project's default database). Config lives in `src/lib/firebase.js` — Firebase web config values aren't secret, so they're committed directly rather than injected at build time.

Auth is Google Sign-In (not email/password) restricted to one fixed Google account. The Firestore security rules enforcing that live in `firestore.rules` — paste that file's contents into Firebase console → Firestore Database → select the `packliste` database → Rules tab → Publish (there's no Firebase CLI wired up in this repo, so rule changes are deployed manually via the console for now).
