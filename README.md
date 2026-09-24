# CS2 Playbook

Desktop app for planning Counter-Strike 2 tactics as a team: strats on the real map radars, player tokens with your own jersey photos, utility, movement paths, step-by-step executes, lineups, map pool & veto and round/economy plans.

Works fully **offline** – no server, no account. Teams share their playbook by exporting a `.cs2pb` file (e.g. in Discord) that teammates import. The app updates itself from GitHub releases.

![icon](app-icon.svg)

## Features

- **Tactic editor** on all CS2 radars (Dust II, Mirage, Inferno, Nuke, Ancient, Anubis, Vertigo, Overpass, Train, Cache), incl. lower levels on Nuke/Vertigo/Train
  - Player tokens as **jersey cutout** or **round avatar** (toggle), per-player role + instructions (like the table under each strat)
  - Smokes, flashes, mollies, HEs, decoys with throw spot → landing, assigned to a player
  - Arrows / movement paths, lines, freehand, areas, vision cones, text, markers (bomb, AWP, …), enemy positions
  - **Steps** (Setup → Execute → Post-plant) with animated playback and a present mode for team reviews
  - Undo/redo, keyboard shortcuts, zoom & pan
- **Lineups** library with screenshots/clips (paste with Ctrl+V), `setpos` import, linkable from tactics
- **Callouts** from the game files, editable per map
- **Roster & roles**: players, photos, colors, default role lineups (T/CT, per-map overrides)
- **Map pool & veto**: priorities, comfort, veto planner (BO1/BO3/BO5) with auto-fill
- **Round plans**: pistol / eco / force buy plans with per-player buys and cost
- **Export**: `.cs2pb` share files (merge-import with conflict handling), PNG image (copy straight to Discord), **PDF playbook**
- Automatic backups (daily + before every import/restore), English & German UI

## Install

1. Download `CS2.Playbook_x.y.z_x64-setup.exe` from the [latest release](https://github.com/RealKnoblauchbrot/cs2-playbook/releases/latest).
2. Run it. Windows SmartScreen may warn because the installer isn't code-signed: **More info → Run anyway**.
3. On start the app checks for a newer release and asks before updating.

Your data lives in `%APPDATA%\com.realknoblauchbrot.cs2playbook` (playbook, media, backups) and is never touched by updates.

## Sharing with the team

- **IGL / whoever edits:** `Export` (sidebar) → pick what to share → save the `.cs2pb` file → post it in Discord.
- **Teammates:** download the file and double-click it (or use `Import` in the sidebar). The import dialog shows what's new, newer or older and lets you choose per item. Players are matched by name, so nobody gets duplicates.
- New teammates can start directly from the file on the welcome screen ("Import playbook file").

## Player photos

Under **Roster & Roles** each player has two pictures:

- **Cutout** – the player in the jersey with transparent background (PNG). Shown standing on the map.
- **Avatar** – a face picture, shown in round tokens and lists. If missing, the cutout is used.

To make cutouts: Windows Photos / Paint "Remove background", or any background remover, then save as PNG.

## Development

Requirements: Node.js 22+, Rust (stable), Windows with WebView2.

```bash
npm install
npm run app        # desktop app with hot reload (tauri dev)
npm run dev        # UI only in the browser (uses IndexedDB instead of files)
npm run build      # typecheck + production frontend build
npx tauri build    # local installer (needs the signing key env vars, see below)
```

Project layout:

| Path | What |
| --- | --- |
| `src/model` | Data model (`types.ts`), factories, migrations for older files |
| `src/store` | Zustand stores: playbook (autosave, undo/redo), settings, toasts |
| `src/components/board` | Konva map board and all drawable objects |
| `src/components/editor` | Tactic editor UI (toolbar, side panel, steps) |
| `src/pages` | Screens |
| `src/lib` | Platform layer (Tauri / browser), media, share files, PNG/PDF export |
| `src/locales` | UI translations |
| `src-tauri` | Rust shell: file access, updater, single instance, `.cs2pb` file association |
| `public/assets` | Map radars, covers, icons, equipment icons (from CS2) |
| `tools` | Asset extraction, release script, i18n checker |

### Adding a language

Copy `src/locales/en.json` to e.g. `src/locales/fr.json`, translate the values and set `"_meta": { "name": "Français" }`. It shows up in Settings automatically. `python tools/check_i18n.py` lists missing keys.

### Updating map radars / callouts

When Valve changes a map, re-extract assets from your local CS2 install with [Source2Viewer CLI](https://github.com/ValveResourceFormat/ValveResourceFormat/releases):

```bash
pip install pillow
python tools/extract_assets.py --cli path/to/Source2Viewer-CLI.exe
```

This rewrites `public/assets/maps/*`, `public/assets/equipment/*` and `src/data/maps.generated.json` (radar metadata + callout positions from the maps' `env_cs_place` entities).

### Releasing an update

```bash
npm run release -- 0.2.0 "New: lineup videos" "Fix: Nuke callouts"
# or: npm run release -- patch   (notes from git log)
```

This bumps the version in all files, commits, tags `v0.2.0` and pushes. The **Release** workflow builds the Windows installer, signs the update and publishes the GitHub release with `latest.json`. Installed apps offer the update on their next start.

The workflow needs two repository secrets (already set up for this repo):

- `TAURI_SIGNING_PRIVATE_KEY` – content of the updater private key
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` – its password

The key pair was generated with `npx tauri signer generate`; the public key is in `src-tauri/tauri.conf.json`. **Keep a backup of the private key** – without it, existing installs can't verify future updates.

## Legal

Map radars, map icons and equipment icons are extracted from Counter-Strike 2 and are © Valve Corporation. This project is not affiliated with or endorsed by Valve.
