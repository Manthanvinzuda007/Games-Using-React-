<div align="center">

```
 ██████╗  █████╗ ███╗   ███╗███████╗    ██╗  ██╗██╗   ██╗██████╗
██╔════╝ ██╔══██╗████╗ ████║██╔════╝    ██║  ██║██║   ██║██╔══██╗
██║  ███╗███████║██╔████╔██║█████╗      ███████║██║   ██║██████╔╝
██║   ██║██╔══██║██║╚██╔╝██║██╔══╝      ██╔══██║██║   ██║██╔══██╗
╚██████╔╝██║  ██║██║ ╚═╝ ██║███████╗    ██║  ██║╚██████╔╝██████╔╝
 ╚═════╝ ╚═╝  ╚═╝╚═╝     ╚═╝╚══════╝    ╚═╝  ╚═╝ ╚═════╝ ╚═════╝
```

# 🎮 The Ultimate React Games Collection

**8 hand-crafted browser games — built with React + Vite. Play anywhere. Zero installs.**

[![React](https://img.shields.io/badge/React-18+-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5+-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-3+-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES2022-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![License](https://img.shields.io/badge/License-MIT-22C55E?style=for-the-badge)](LICENSE)

</div>

---

## 🗂️ Table of Contents

- [🎯 About The Project](#-about-the-project)
- [🕹️ Games Collection](#️-games-collection)
- [🏗️ Project Structure](#️-project-structure)
- [⚙️ Prerequisites](#️-prerequisites)
- [🚀 Installation & Setup](#-installation--setup)
- [▶️ Running The Games](#️-running-the-games)
- [🛠️ Tech Stack](#️-tech-stack)
- [📁 Each Game — At a Glance](#-each-game--at-a-glance)
- [🤝 Contributing](#-contributing)
- [📜 License](#-license)

---

## 🎯 About The Project

> *"Games are the most elevated form of investigation."* — Albert Einstein

This repository is a **curated collection of 8 classic games**, each rebuilt from scratch as a standalone **React + Vite** application. Whether you're here to play, learn from the code, or contribute — you're in the right place.

Every game is:
- ✅ **Self-contained** — its own folder, its own dependencies
- ✅ **Blazing fast** — powered by Vite's lightning HMR
- ✅ **Modern React** — functional components, hooks, clean state management
- ✅ **Zero backend** — pure frontend, runs entirely in the browser

---

## 🕹️ Games Collection

| # | Game | Difficulty | Players | Tech Highlights |
|---|------|-----------|---------|----------------|
| ♟️ | **Chess** | ⭐⭐⭐⭐⭐ | 2P Local | Complex game tree, move validation |
| 🎲 | **Backgammon** | ⭐⭐⭐⭐ | 2P Local | Dice logic, piece bearing off |
| 🔴 | **Connect 4** | ⭐⭐ | 2P Local | Win detection, gravity physics |
| ⬛ | **Checkers** | ⭐⭐⭐ | 2P Local | Jump chains, king promotion |
| 💣 | **Minesweeper** | ⭐⭐ | 1P | Flood fill, mine generation |
| 🔢 | **Sudoku** | ⭐⭐⭐ | 1P | Puzzle gen, backtracking solver |
| 🏓 | **Table Tennis** | ⭐⭐ | 1-2P | Canvas animation, collision |
| ❌⭕ | **XO (Tic-Tac-Toe)** | ⭐ | 2P Local | Minimax AI, win detection |

---

## 🏗️ Project Structure

```
📦 Games-Collection/
│
├── 🎲 Backgammon_Game/
│   └── src/  App.jsx · index.css · main.jsx
│
├── ⬛ Checkers_Game/          ← uses Tailwind CSS
│   └── src/  App.jsx · index.css · main.jsx
│
├── ♟️ Chess_Game/
│   └── src/  App.jsx · index.css · main.jsx
│
├── 🔴 Connect_4/
│   └── src/  App.jsx · index.css · main.jsx
│
├── 💣 Mineweeper_Game/        ← uses Tailwind CSS
│   └── src/  App.jsx · index.css · main.jsx
│
├── 🔢 Sudoku_Game/
│   └── src/  App.jsx · index.css · main.jsx
│
├── 🏓 Table_Tanis/            ← uses Tailwind CSS
│   └── src/  App.jsx · index.css · main.jsx
│
├── ❌ XO_Game/
│   └── src/  App.jsx · index.css · main.jsx
│
└── 📝 README.md               ← you are here
```

> Each game folder is a **fully independent Vite project** — install and run them separately.

---

## ⚙️ Prerequisites

Before running any game, make sure you have the following installed:

### 1. Node.js (v18 or higher)

```bash
# Check your version
node --version   # Should be v18+
npm --version    # Should be v9+
```

> 📥 Download Node.js → [https://nodejs.org](https://nodejs.org)  
> 💡 We recommend using [nvm](https://github.com/nvm-sh/nvm) to manage Node versions.

### 2. Git (to clone the repo)

```bash
git --version    # Any recent version is fine
```

> 📥 Download Git → [https://git-scm.com](https://git-scm.com)

---

## 🚀 Installation & Setup

### Step 1 — Clone the Repository

```bash
git clone https://github.com/your-username/games-collection.git
cd games-collection
```

### Step 2 — Navigate to a Game

Each game is its own project. Pick the one you want to play:

```bash
# Examples:
cd Chess_Game
cd Backgammon_Game
cd XO_Game
# ...and so on
```

### Step 3 — Install Dependencies

```bash
npm install
```

> This installs all required packages listed in `package.json` into a local `node_modules/` folder.

---

## ▶️ Running The Games

### 🔥 Development Mode (with Hot Reload)

```bash
npm run dev
```

Then open your browser and visit:

```
http://localhost:5173
```

> Vite's dev server starts almost instantly and auto-reloads on every file save. ⚡

---

### 📦 Build for Production

```bash
npm run build
```

This compiles and optimizes the game into the `dist/` folder — ready to deploy anywhere (Netlify, Vercel, GitHub Pages, etc.).

### 👀 Preview the Production Build Locally

```bash
npm run preview
```

Opens the production build at:

```
http://localhost:4173
```

---

### 🔍 Lint Your Code

```bash
npm run lint
```

Uses ESLint to catch errors and enforce code style across the project.

---

## ⚡ Quick-Start Cheatsheet

```bash
# Clone once
git clone https://github.com/your-username/games-collection.git

# Then for ANY game, repeat these 3 steps:
cd <Game_Folder>
npm install
npm run dev
```

---

## 🛠️ Tech Stack

| Technology | Purpose | Version |
|-----------|---------|---------|
| ⚛️ **React** | UI components & state management | 18+ |
| ⚡ **Vite** | Dev server + production bundler | 5+ |
| 🎨 **Tailwind CSS** | Utility-first styling *(some games)* | 3+ |
| 🟨 **JavaScript (ES2022)** | Game logic | ESNext |
| 🔍 **ESLint** | Code quality & linting | 9+ |
| 📦 **npm** | Package management | 9+ |

---

## 📁 Each Game — At a Glance

<details>
<summary>♟️ <strong>Chess Game</strong></summary>

A fully playable 2-player chess game in the browser.

- ✅ Full piece movement rules (castling, en passant, promotion)
- ✅ Check & checkmate detection
- ✅ Turn-based gameplay with visual highlights

```bash
cd Chess_Game && npm install && npm run dev
```
</details>

<details>
<summary>🎲 <strong>Backgammon Game</strong></summary>

Classic board game with dice rolling and full rule enforcement.

- ✅ Dice roll simulation
- ✅ Legal move highlighting
- ✅ Bearing off logic

```bash
cd Backgammon_Game && npm install && npm run dev
```
</details>

<details>
<summary>🔴 <strong>Connect 4</strong></summary>

Drop discs, connect four, win — simple and satisfying.

- ✅ Gravity-based piece dropping
- ✅ Win detection (horizontal, vertical, diagonal)
- ✅ Animated disc drops

```bash
cd Connect_4 && npm install && npm run dev
```
</details>

<details>
<summary>⬛ <strong>Checkers Game</strong></summary>

Classic draught-style checkers with king promotion.

- ✅ Multi-jump chains
- ✅ King piece promotion
- ✅ Forced capture rules

```bash
cd Checkers_Game && npm install && npm run dev
```
</details>

<details>
<summary>💣 <strong>Minesweeper</strong></summary>

The timeless puzzle — clear the board without hitting a mine.

- ✅ Randomized mine placement
- ✅ Flood-fill auto-reveal
- ✅ Flag placement + win/lose detection

```bash
cd Mineweeper_Game && npm install && npm run dev
```
</details>

<details>
<summary>🔢 <strong>Sudoku Game</strong></summary>

The classic number puzzle — now in your browser.

- ✅ Puzzle generation with difficulty levels
- ✅ Input validation (highlights errors)
- ✅ Hint system & solver

```bash
cd Sudoku_Game && npm install && npm run dev
```
</details>

<details>
<summary>🏓 <strong>Table Tennis</strong></summary>

Fast-paced ping pong with smooth canvas-based animation.

- ✅ Paddle control (keyboard)
- ✅ Ball physics & collision
- ✅ Score tracking

```bash
cd Table_Tanis && npm install && npm run dev
```
</details>

<details>
<summary>❌⭕ <strong>XO Game (Tic-Tac-Toe)</strong></summary>

The game that started it all — now with an optional AI opponent.

- ✅ 2-player local mode
- ✅ Win / draw detection
- ✅ Clean animated UI

```bash
cd XO_Game && npm install && npm run dev
```
</details>

---

## 🤝 Contributing

Contributions are what make the open-source community amazing. Any contributions you make are **greatly appreciated**! 🙌

### How to Contribute

```bash
# 1. Fork the project
# 2. Create your feature branch
git checkout -b feature/AmazingFeature

# 3. Commit your changes
git commit -m 'Add some AmazingFeature'

# 4. Push to the branch
git push origin feature/AmazingFeature

# 5. Open a Pull Request 🎉
```

### Ideas for Contributions

- 🤖 Add an AI opponent to any game
- 🌐 Add online multiplayer (via WebSockets)
- 🎵 Add sound effects
- 📱 Improve mobile responsiveness
- 🌙 Add dark/light theme toggle
- 🏆 Add a leaderboard / high score system

---

## 📜 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for more information.

```
MIT License — free to use, modify, and distribute.
Just keep the attribution. 🙂
```

---

<div align="center">

Made with ❤️ and React

⭐ **Star this repo if you found it useful!** ⭐

</div>
