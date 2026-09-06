# 🔐 Memory Lock

A simple, private notebook for the web — where you can save your thoughts, ideas, and secrets, and lock the sensitive ones with a PIN.

---

## ❓ What is this project?

Memory Lock is a web app that works like a digital diary or notes app. You type in a note (called a "memory"), give it a title and category, and save it. If a note is private, you can lock it with a PIN so nobody else can read it without entering the code.

## 🤔 Why was it made?

Most note apps either have no privacy at all, or lock the *whole app* behind one password. Memory Lock lets you protect **individual notes** while keeping the rest of your notes open — so you don't need a PIN just to check your grocery list, but your secrets stay hidden.

## 👤 Who is it for?

- Anyone who wants a simple personal notes app
- People who want to keep some notes private (diary entries, passwords reminders, secrets) without locking the whole app
- Students/developers who want a small, easy-to-read project to learn how login systems, databases, and note-taking apps work
- No technical knowledge is needed to *use* the app — only to run/install it

## 📍 Where does it run?

It runs on your own computer (or any server) as a local website. You open it in a web browser like Chrome or Firefox, just like any other website.

## ⏰ When would you use it?

- Whenever you want to jot down a quick thought, idea, or reminder
- When you want to keep a private diary or list of secrets
- When you want to track your daily writing habit (there's a built-in streak tracker)

## 🛠 How does it work?

1. You create an account (or use the demo account).
2. You add a memory: give it a title, write the content, pick a category (Personal, Work, Ideas, Secrets, Important), and optionally add tags or a picture.
3. If it's private, click the lock icon and set a PIN.
4. To read a locked memory later, you enter the PIN.
5. You can search, filter, sort, pin favorites, and even share a memory with a temporary public link.

---

## ✨ Main Features (in plain words)

| Feature | What it does |
|---|---|
| 🔑 Accounts | Sign up and log in, so your notes are private to you |
| 🔒 PIN Lock | Lock any single note with its own PIN |
| 🗂️ Categories & Tags | Organize notes into groups and label them |
| ✍️ Markdown Writing | Format text (bold, lists, etc.) as you type |
| 🖼️ Images | Attach a picture to a note |
| 🎤 Voice Typing | Speak instead of typing |
| 🔥 Streaks | See how many days in a row you've added notes |
| 📊 Stats | See totals, categories, and fun facts about your notes |
| 🔍 Search & Sort | Quickly find notes, filter by tag/date, sort by newest/oldest/A–Z |
| 🔗 Share Link | Create a link so someone else can view one note (link expires automatically) |
| 🌗 Light/Dark Mode | Switch how the app looks |

---

## 🚀 How to run it

**You'll need:** [Node.js](https://nodejs.org) version 22 or newer installed on your computer.

```bash
# 1. Download the project
git clone <this-repo-url>
cd memory-lock

# 2. Install what it needs
npm install

# 3. Start the app
npm start
```

Then open your browser and go to:

```
http://localhost:3000
```

**Want to try it without creating an account?** Use the built-in demo login:
- Username: `demo`
- Password: `demo123`

### Running tests (optional, for developers)

```bash
npm test
```

---

## 📁 What's inside the project (basic overview)

```
server.js     → the backend, handles logins, saving/loading notes
db.js         → the database logic (stores everything in a local file)
public/       → everything you see in the browser (pages, styling, buttons)
tests/        → automated checks that make sure things work correctly
data/         → where your notes and accounts are stored
```

---

## 🔒 Is it safe?

- Passwords and PINs are never stored as plain text — they're scrambled (hashed) before saving
- Each user can only see and edit their own notes
- Locked notes hide their content until the correct PIN is entered
- Login attempts are limited to stop guessing attacks

---

## 📄 License

MIT — free to use, copy, and modify.
