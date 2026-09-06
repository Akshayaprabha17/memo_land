<div align="center">

<img src="screenshots/hero.png" alt="Memory Lock - Your Personal Vault" width="800" />

### **Your Private Memory Vault**

*A personal notebook where you decide what stays open and what gets locked.*

<p>

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22-339933?logo=node.js&logoColor=white)](package.json)
[![Express](https://img.shields.io/badge/express-4.x-000000?logo=express&logoColor=white)](package.json)
[![SQLite](https://img.shields.io/badge/better--sqlite3-13.x-003B57?logo=sqlite&logoColor=white)](package.json)

[Quick Start](#quick-start) · [Features](#key-features) · [Screenshots](#a-closer-look) · [Tech Stack](#tech-stack) · [Contributing](#contributing)

</p>
</div>

## What is Memory Lock?

Memory Lock is a personal vault for notes, ideas, and secrets — the things you'd write in a diary but don't necessarily want visible the second someone glances at your screen. Instead of locking an entire app behind one password, it lets you lock **individual memories** with their own PIN, while everything else stays open and quick to get to.

Write in Markdown, tag things, sort them into categories, attach a picture, dictate a note out loud, or share a single memory with a link that expires on its own. Everything runs on a small Express server with a local SQLite database — no external services, no accounts on someone else's server.

If you have never touched the codebase before, it's small enough to read start to finish in an afternoon.

---

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org) v22 or newer
- npm

### Install and run

```bash
git clone <this-repo-url>
cd memory-lock
npm install
npm start
```

Open **http://localhost:3000**, create an account (or use the demo login below), and start writing.

> **Just want to poke around first?** Log in with username `demo` / password `demo123` — it's seeded automatically on first run.

<details>
<summary><b>Development mode (auto-restart on changes)</b></summary>

```bash
npm run dev
```

</details>

<details>
<summary><b>Running the test suite</b></summary>

```bash
npm test
```

Tests cover registration/login flows and memory CRUD, including ownership checks so one account can never read or edit another account's memories.

</details>

---

## Core Capabilities

### Lock any memory with its own PIN

Every memory has an independent lock. Set a PIN on the ones that matter, leave the rest open — no need to unlock the whole vault just to read a grocery list.

<p align="center">
  <img src="screenshots/pin-lock.png" alt="Locked memory PIN entry" width="60%" />
</p>

### Write in Markdown, organize as you go

A Write/Preview toggle shows formatted text as you type. Every memory gets a category and optional tags, so things stay searchable as your vault grows.

<p align="center">
  <img src="screenshots/new-memory.png" alt="Creating a new memory" width="70%" />
</p>

### Track your own consistency

A GitHub-style activity heatmap and streak counter show how many days in a row you've actually written something — click any day to filter your vault to that date.

<p align="center">
  <img src="screenshots/streaks.png" alt="Activity streak and category filters" width="90%" />
</p>

### Share one memory, not your whole account

Generate a read-only link for a single unlocked memory. It expires automatically, so there's no lingering access to clean up later.

<p align="center">
  <img src="screenshots/memory-detail.png" alt="Memory detail with share option" width="55%" />
</p>

<p align="center">
  <img src="screenshots/share-link.png" alt="Public read-only shared memory" width="65%" />
</p>

---

## Key Features

| Feature | Description |
| --- | --- |
| **Accounts** | Multi-user support with session tokens; each account's memories are fully isolated |
| **Per-Memory PIN Lock** | Lock/unlock individual memories, or temporarily verify a PIN just to view one |
| **Categories & Tags** | Personal, Work, Ideas, Secrets, Important — plus free-form tags with usage counts |
| **Markdown Editor** | Live Write/Preview tabs, sanitized rendering (`marked` + `DOMPurify`) |
| **Image Attachments** | Attach a picture to any memory |
| **Voice-to-Text** | Dictate a memory using the browser's Web Speech API |
| **Activity Heatmap** | Daily contribution grid with current/longest streak tracking |
| **Stats Dashboard** | Totals, category breakdown, top tags, and a few auto-generated fun facts |
| **Search, Sort & Filter** | Full-text search, filter by tag/date/category, sort newest/oldest/A–Z/most-edited |
| **Drag & Drop + Pinning** | Manually reorder memories, pin favorites to the top |
| **Public Share Links** | Time-limited, read-only links for individual unlocked memories |
| **Light / Dark Theme** | Toggle stored per device |
| **Rate Limiting** | Login and PIN-verification endpoints are throttled against brute-force attempts |

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| **Backend** | Node.js, Express |
| **Database** | SQLite via `better-sqlite3`, auto-migrated from seed JSON on first run |
| **Frontend** | Vanilla HTML / CSS / JavaScript — no framework |
| **Images** | `sharp` for asset processing |
| **Auth** | PBKDF2 (SHA-512) password/PIN hashing, random session tokens |
| **Testing** | Jest + Supertest |

---

## Project Structure

```
server.js     → Express app, routes, auth, PIN logic, public share pages
db.js         → SQLite schema, queries, and JSON → SQLite migration
public/       → frontend: index.html, style.css, app.js
tests/        → auth and memory CRUD / ownership (IDOR) tests
data/         → seed JSON + the local SQLite database
```

---

## Security

- Passwords and PINs are hashed (PBKDF2, per-record salt) — nothing is stored in plain text
- Every memory endpoint checks ownership, so one account can never read or modify another account's data
- Locked memory content is stripped from API responses until a correct PIN is supplied
- Login and PIN-verification endpoints are rate-limited (10 attempts / 15 minutes per IP)

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes and add/update tests
4. Run `npm test`
5. Open a Pull Request

Bug fixes, small feature ideas, and documentation improvements are all welcome.

---

## License

**MIT** — free to use, modify, and self-host. See [LICENSE](LICENSE) for details.

---

<div align="center">

**A small, private place to keep the things worth remembering.**

[Back to Top](#memory-lock)

</div>
