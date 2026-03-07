import { useState, useEffect, useRef, useCallback } from "react";

/* ================= Educational Facts ================= */
const educationalFacts = [
  "Octopuses have three hearts and blue blood! 🐙",
  "Honey never spoils. Explorers found 3,000-year-old honey in Egypt and it was still good! 🍯",
  "Bananas are officially berries, but strawberries are not! 🍌",
  "A day on Venus is longer than a year on Venus! 🪐",
  "Water makes up about 71% of the Earth's surface! 🌊",
  "Wombat poop is cube-shaped so it doesn't roll away! 🦡",
  "A single cloud can weigh more than a million pounds! ☁️",
  "Sharks existed on Earth before trees did! 🦈",
  "Butterflies taste their food with their feet! 🦋",
  "Space is completely silent because there is no air for sound to travel through! 🌌",
  "A single strand of spaghetti is called a 'spaghetto'! 🍝",
  "Cows have best friends and get stressed when separated! 🐄",
  "Snails can sleep for up to three years! 🐌",
];

/* ================= Audio Helpers ================= */
let audioCtx = null;
function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
}
function playTone(freq, type, duration, vol = 0.1) {
  if (!audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + duration);
  } catch (e) {}
}
function playExplosion() {
  if (!audioCtx) return;
  try {
    const bufferSize = audioCtx.sampleRate * 0.5;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (audioCtx.sampleRate * 0.15));
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    const filter = audioCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(500, audioCtx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 0.5);
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.8, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
    noise.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
    noise.start();
  } catch (e) {}
}
function playSound(action, muted) {
  if (muted) return;
  initAudio();
  switch (action) {
    case "click": playTone(600, "sine", 0.1, 0.05); break;
    case "pop": playTone(1200, "triangle", 0.05, 0.03); break;
    case "flag": playTone(800, "square", 0.1, 0.05); setTimeout(() => playTone(1200, "square", 0.1, 0.05), 80); break;
    case "unflag": playTone(600, "square", 0.1, 0.05); break;
    case "chord": playTone(1000, "triangle", 0.15, 0.05); break;
    case "win": [440, 554, 659, 880, 1108].forEach((f, i) => setTimeout(() => playTone(f, "square", 0.2, 0.1), i * 150)); break;
    case "explosion": playExplosion(); break;
    default: break;
  }
}

/* ================= Board Helpers ================= */
const DIRS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];

function createBoard(rows, cols) {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({
      isMine: false, isRevealed: false, isFlagged: false, neighborMines: 0,
    }))
  );
}

function placeMinesOnBoard(board, rows, cols, mines, firstR, firstC) {
  const nb = board.map(r => r.map(c => ({ ...c })));
  let placed = 0;
  while (placed < mines) {
    const r = Math.floor(Math.random() * rows);
    const c = Math.floor(Math.random() * cols);
    const safe = Math.abs(r - firstR) <= 1 && Math.abs(c - firstC) <= 1;
    if (!nb[r][c].isMine && !safe) { nb[r][c].isMine = true; placed++; }
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (nb[r][c].isMine) continue;
      let count = 0;
      DIRS.forEach(([dr, dc]) => {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && nb[nr][nc].isMine) count++;
      });
      nb[r][c].neighborMines = count;
    }
  }
  return nb;
}

/* ================= Canvas Particle System ================= */
function drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
  let rot = Math.PI / 2 * 3;
  let step = Math.PI / spikes;
  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);
  for (let i = 0; i < spikes; i++) {
    ctx.lineTo(cx + Math.cos(rot) * outerRadius, cy + Math.sin(rot) * outerRadius); rot += step;
    ctx.lineTo(cx + Math.cos(rot) * innerRadius, cy + Math.sin(rot) * innerRadius); rot += step;
  }
  ctx.lineTo(cx, cy - outerRadius);
  ctx.closePath();
}

/* ================= Styles (injected once) ================= */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600;700&display=swap');
:root {
  --bg-color: #4cd137; --panel-bg: #fff; --text-color: #2f3640;
  --cell-bg: #f5f6fa; --cell-hover: #dcdde1; --cell-revealed: #e1b12c;
  --border-dark: #111; --primary: #00a8ff; --primary-hover: #0097e6;
  --danger: #e84118; --success: #44bd32; --cell-size: 40px;
}
[data-theme="dark"] {
  --bg-color: #2f3640; --panel-bg: #353b48; --text-color: #f5f6fa;
  --cell-bg: #718093; --cell-hover: #7f8fa6; --cell-revealed: #e1b12c;
  --border-dark: #111; --primary: #9c88ff; --primary-hover: #8c7ae6;
}
* { box-sizing: border-box; margin: 0; padding: 0; user-select: none; -webkit-user-select: none; font-family: 'Fredoka', sans-serif; }
body { background-color: var(--bg-color); background-image: radial-gradient(rgba(0,0,0,0.1) 15%, transparent 16%), radial-gradient(rgba(0,0,0,0.1) 15%, transparent 16%); background-size: 40px 40px; background-position: 0 0, 20px 20px; color: var(--text-color); min-height: 100vh; display: flex; justify-content: center; align-items: center; overflow: hidden; transition: background-color 0.4s ease; }
#ms-root { width: 100%; height: 100vh; display: flex; justify-content: center; align-items: center; }
#effects-canvas { position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 100; }
.ms-screen { position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; opacity: 0; pointer-events: none; transform: scale(0.5) translateY(100px); transition: all 0.5s cubic-bezier(0.68,-0.55,0.265,1.55); }
.ms-screen.active { opacity: 1; pointer-events: all; transform: scale(1) translateY(0); }
.menu-panel { background: var(--panel-bg); padding: 3rem; border-radius: 24px; border: 4px solid var(--border-dark); box-shadow: 8px 8px 0 rgba(0,0,0,0.2); text-align: center; width: 90%; max-width: 450px; animation: float 4s ease-in-out infinite; }
@keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
.menu-title { font-size: 3rem; margin-bottom: 2rem; font-weight: 700; color: var(--primary); text-shadow: 3px 3px 0 var(--border-dark),-1px -1px 0 var(--border-dark),1px -1px 0 var(--border-dark),-1px 1px 0 var(--border-dark),1px 1px 0 var(--border-dark); letter-spacing: 2px; transform: rotate(-2deg); }
.btn-group { display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1.5rem; }
.btn { background: var(--cell-bg); color: var(--text-color); border: 3px solid var(--border-dark); padding: 14px 20px; font-size: 1.2rem; border-radius: 16px; cursor: pointer; box-shadow: 0 6px 0 var(--border-dark); transition: all 0.1s; font-weight: 700; position: relative; }
.btn:hover { transform: translateY(-2px); box-shadow: 0 8px 0 var(--border-dark); background: var(--cell-hover); }
.btn:active { transform: translateY(6px); box-shadow: 0 0 0 var(--border-dark); }
.btn.active-btn { background: var(--primary); color: #fff; }
.custom-inputs { display: none; gap: 0.8rem; margin-top: 1rem; justify-content: center; }
.custom-inputs.show { display: flex; animation: elasticPop 0.4s cubic-bezier(0.68,-0.55,0.265,1.55); }
.custom-input { width: 75px; padding: 10px; border-radius: 12px; border: 3px solid var(--border-dark); background: #fff; color: #111; text-align: center; font-weight: bold; font-size: 1.1rem; box-shadow: 0 4px 0 var(--border-dark); }
.start-btn { background: var(--danger); color: white; font-size: 1.6rem; padding: 16px; width: 100%; margin-top: 1.5rem; transform: rotate(1deg); }
.start-btn:hover { background: #c23616; }
.game-wrapper { background: var(--panel-bg); padding: 25px; border-radius: 24px; border: 5px solid var(--border-dark); box-shadow: 10px 10px 0 rgba(0,0,0,0.3); display: flex; flex-direction: column; gap: 20px; max-width: 98vw; max-height: 98vh; position: relative; }
.top-bar { display: flex; justify-content: space-between; align-items: center; background: var(--cell-bg); padding: 12px 25px; border-radius: 16px; border: 3px solid var(--border-dark); box-shadow: 0 4px 0 var(--border-dark); }
.lcd-text { font-size: 2rem; font-weight: bold; color: var(--danger); background: #222; padding: 5px 15px; border-radius: 10px; min-width: 90px; text-align: center; border: 3px solid var(--border-dark); box-shadow: inset 0 5px 0 rgba(0,0,0,0.5); text-shadow: 0 0 5px var(--danger); }
.face-btn { font-size: 2.5rem; cursor: pointer; background: #fff; border: 3px solid var(--border-dark); border-radius: 50%; width: 65px; height: 65px; display: flex; justify-content: center; align-items: center; box-shadow: 0 5px 0 var(--border-dark); transition: all 0.1s; }
.face-btn:active { transform: translateY(5px); box-shadow: 0 0 0 var(--border-dark); }
.board-scroll-container { overflow: auto; border-radius: 16px; padding: 15px; background: rgba(0,0,0,0.05); max-width: 100%; max-height: 60vh; border: 3px solid var(--border-dark); box-shadow: inset 0 5px 10px rgba(0,0,0,0.1); }
.board-scroll-container::-webkit-scrollbar { width: 12px; height: 12px; }
.board-scroll-container::-webkit-scrollbar-track { background: var(--cell-bg); border-radius: 6px; border: 2px solid var(--border-dark); }
.board-scroll-container::-webkit-scrollbar-thumb { background: var(--primary); border-radius: 6px; border: 2px solid var(--border-dark); }
.grid { display: grid; gap: 4px; margin: auto; width: max-content; }
.cell { width: var(--cell-size); height: var(--cell-size); background: var(--cell-bg); border: 3px solid var(--border-dark); border-radius: 8px; display: flex; justify-content: center; align-items: center; font-weight: 800; font-size: calc(var(--cell-size) * 0.6); cursor: pointer; box-shadow: 0 4px 0 var(--border-dark); transition: background 0.2s; }
.cell:hover:not(.revealed) { background: var(--cell-hover); transform: translateY(-2px); box-shadow: 0 6px 0 var(--border-dark); }
.cell:active:not(.revealed):not(.flagged) { transform: translateY(4px); box-shadow: 0 0 0 var(--border-dark); }
.cell.revealed { background: var(--cell-revealed); box-shadow: inset 0 4px 0 rgba(0,0,0,0.1); transform: translateY(4px); cursor: default; }
.cell.mine { background-color: var(--danger); animation: shakeBomb 0.5s infinite alternate; z-index: 10; }
.cell.flagged { font-size: calc(var(--cell-size) * 0.5); }
.cell.wrong-flag { background-color: var(--danger) !important; }
.cell.hit-mine { transform: scale(1.5) !important; z-index: 20 !important; }
.num { text-shadow: 2px 2px 0 #000,-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000,1px 1px 0 #000; }
.num-1{color:#3498db}.num-2{color:#2ecc71}.num-3{color:#e74c3c}.num-4{color:#9b59b6}.num-5{color:#f1c40f}.num-6{color:#1abc9c}.num-7{color:#34495e}.num-8{color:#95a5a6}
.controls { display: flex; justify-content: space-between; align-items: center; padding: 0 10px; }
.icon-btn { background: #fff; border: 3px solid var(--border-dark); border-radius: 50%; width: 50px; height: 50px; font-size: 1.5rem; cursor: pointer; color: var(--text-color); box-shadow: 0 4px 0 var(--border-dark); transition: all 0.1s; display: flex; justify-content: center; align-items: center; }
.icon-btn:active { transform: translateY(4px); box-shadow: 0 0 0 var(--border-dark); }
.fact-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(5px); z-index: 150; display: flex; justify-content: center; align-items: center; opacity: 0; pointer-events: none; transition: opacity 0.3s ease; }
.fact-overlay.show { opacity: 1; pointer-events: all; }
.fact-modal { background: var(--panel-bg); border: 5px solid var(--border-dark); border-radius: 24px; padding: 30px; box-shadow: 10px 10px 0 rgba(0,0,0,0.5); text-align: center; max-width: 450px; width: 90%; transform: scale(0.5); transition: transform 0.4s cubic-bezier(0.68,-0.55,0.265,1.55); }
.fact-overlay.show .fact-modal { transform: scale(1) rotate(-1deg); }
.fact-title { color: var(--primary); font-size: 2.2rem; font-weight: 800; display: block; margin-bottom: 15px; text-shadow: 2px 2px 0 var(--border-dark); }
.fact-text { font-size: 1.4rem; color: var(--text-color); font-weight: 600; margin-bottom: 25px; line-height: 1.4; }
.fact-resume-btn { background: var(--success); color: white; border: 3px solid var(--border-dark); font-size: 1.4rem; padding: 15px 25px; border-radius: 16px; cursor: pointer; box-shadow: 0 6px 0 var(--border-dark); font-weight: bold; width: 100%; transition: all 0.1s; }
.fact-resume-btn:active { transform: translateY(6px); box-shadow: 0 0 0 var(--border-dark); }
.flash-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: #ff4757; pointer-events: none; opacity: 0; z-index: 50; transition: opacity 0.1s; mix-blend-mode: overlay; }
.flash-overlay.active { opacity: 0.8; }
.pro-tip { font-size: 0.85rem; font-weight: bold; color: var(--text-color); background: rgba(255,255,255,0.8); padding: 5px 10px; border-radius: 8px; border: 2px dashed var(--border-dark); }
@keyframes elasticPop { 0%{transform:scale(0.5);opacity:0} 50%{transform:scale(1.2)} 70%{transform:scale(0.9)} 100%{transform:scale(1);opacity:1} }
.anim-pop { animation: elasticPop 0.4s cubic-bezier(0.175,0.885,0.32,1.275) forwards; }
@keyframes rubberBand { 0%{transform:scale(1)} 30%{transform:scaleX(1.25) scaleY(0.75)} 40%{transform:scaleX(0.75) scaleY(1.25)} 60%{transform:scaleX(1.15) scaleY(0.85)} 100%{transform:scale(1)} }
.anim-rubber { animation: rubberBand 0.5s ease-out; }
@keyframes violentShake { 0%,100%{transform:translate(0,0) rotate(0)} 10%,30%,50%,70%,90%{transform:translate(-10px,-10px) rotate(-3deg)} 20%,40%,60%,80%{transform:translate(10px,10px) rotate(3deg)} }
.shake-screen { animation: violentShake 0.5s cubic-bezier(.36,.07,.19,.97) both; }
@keyframes shakeBomb { 0%{transform:translateY(4px) scale(1) rotate(-10deg)} 100%{transform:translateY(4px) scale(1.2) rotate(10deg)} }
`;

/* ================= Main App ================= */
export default function App() {
  // Inject CSS once
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  const [screen, setScreen] = useState("menu"); // menu | game
  const [theme, setTheme] = useState("light");
  const [difficulty, setDifficulty] = useState("easy");
  const [customRows, setCustomRows] = useState(10);
  const [customCols, setCustomCols] = useState(10);
  const [customMines, setCustomMines] = useState(15);

  const [config, setConfig] = useState({ rows: 9, cols: 9, mines: 10 });
  const [board, setBoard] = useState([]);
  const [gameStatus, setGameStatus] = useState("playing"); // playing | paused | won | lost
  const [minesLeft, setMinesLeft] = useState(10);
  const [revealedCount, setRevealedCount] = useState(0);
  const [firstClick, setFirstClick] = useState(true);
  const [muted, setMuted] = useState(false);
  const [face, setFace] = useState("😎");
  const [flash, setFlash] = useState(false);
  const [shakeScreen, setShakeScreen] = useState(false);
  const [factVisible, setFactVisible] = useState(false);
  const [currentFact, setCurrentFact] = useState("");

  // Cell animation states: { "r,c": animClass }
  const [cellAnims, setCellAnims] = useState({});

  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const animFrameRef = useRef(null);
  const factTimerRef = useRef(null);
  const touchTimerRef = useRef(null);
  const touchMovedRef = useRef(false);

  // Refs for game state (to avoid stale closures in timers)
  const gameStatusRef = useRef(gameStatus);
  const mutedRef = useRef(muted);
  const boardRef = useRef(board);
  const configRef = useRef(config);
  const minesLeftRef = useRef(minesLeft);
  const revealedCountRef = useRef(revealedCount);
  const firstClickRef = useRef(firstClick);

  useEffect(() => { gameStatusRef.current = gameStatus; }, [gameStatus]);
  useEffect(() => { mutedRef.current = muted; }, [muted]);
  useEffect(() => { boardRef.current = board; }, [board]);
  useEffect(() => { configRef.current = config; }, [config]);
  useEffect(() => { minesLeftRef.current = minesLeft; }, [minesLeft]);
  useEffect(() => { revealedCountRef.current = revealedCount; }, [revealedCount]);
  useEffect(() => { firstClickRef.current = firstClick; }, [firstClick]);

  // Theme
  useEffect(() => {
    document.body.setAttribute("data-theme", theme === "dark" ? "dark" : "");
  }, [theme]);

  // Canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // ---- Particle system ----
  const updateParticles = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let active = false;
    const ps = particlesRef.current;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life -= p.decay;
      if (p.life > 0) {
        active = true;
        ctx.save();
        if (p.type === "dust") {
          p.x += p.vx; p.y += p.vy; p.radius += 0.5;
          ctx.globalAlpha = p.life;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = "#fff"; ctx.fill();
          ctx.lineWidth = 3; ctx.strokeStyle = "#111"; ctx.stroke();
        } else if (p.type === "boom") {
          p.radius += (p.maxRadius - p.radius) * 0.2;
          ctx.globalAlpha = p.life;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = "#ff9f43"; ctx.fill();
          ctx.lineWidth = 5; ctx.strokeStyle = "#111"; ctx.stroke();
        } else if (p.type === "star") {
          p.x += p.vx; p.y += p.vy; p.rotation += p.rotSpeed;
          ctx.globalAlpha = p.life;
          ctx.translate(p.x, p.y); ctx.rotate(p.rotation * Math.PI / 180);
          drawStar(ctx, 0, 0, 5, p.radius * 2, p.radius);
          ctx.fillStyle = "#feca57"; ctx.fill();
          ctx.lineWidth = 3; ctx.strokeStyle = "#111"; ctx.stroke();
        } else if (p.type === "confetti") {
          p.vx *= p.friction; p.vy *= p.friction; p.vy += p.gravity;
          p.x += p.vx; p.y += p.vy; p.rotation += p.rotSpeed;
          ctx.globalAlpha = p.life;
          ctx.translate(p.x, p.y); ctx.rotate(p.rotation * Math.PI / 180);
          ctx.fillStyle = p.color; ctx.fillRect(-p.width/2, -p.height/2, p.width, p.height);
          ctx.lineWidth = 3; ctx.strokeStyle = "#111"; ctx.strokeRect(-p.width/2, -p.height/2, p.width, p.height);
        }
        ctx.restore();
      } else { ps.splice(i, 1); }
    }
    if (active) { animFrameRef.current = requestAnimationFrame(updateParticles); }
    else { animFrameRef.current = null; }
  }, []);

  const spawnDust = useCallback((x, y) => {
    for (let i = 0; i < 8; i++) {
      particlesRef.current.push({ type: "dust", x, y, vx: (Math.random()-0.5)*8, vy: (Math.random()-0.5)*8, radius: Math.random()*8+4, life: 1, decay: 0.05 });
    }
    if (!animFrameRef.current) updateParticles();
  }, [updateParticles]);

  const spawnExplosion = useCallback((x, y) => {
    particlesRef.current.push({ type: "boom", x, y, radius: 10, maxRadius: 150, life: 1, decay: 0.03 });
    for (let i = 0; i < 15; i++) {
      particlesRef.current.push({ type: "star", x, y, vx:(Math.random()-0.5)*20, vy:(Math.random()-0.5)*20, rotation:Math.random()*360, rotSpeed:(Math.random()-0.5)*15, radius:Math.random()*10+5, life:1, decay:0.02 });
    }
    if (!animFrameRef.current) updateParticles();
  }, [updateParticles]);

  const spawnConfetti = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const colors = ["#e84118","#4cd137","#00a8ff","#fbc531","#9c88ff"];
    for (let i = 0; i < 150; i++) {
      particlesRef.current.push({ type:"confetti", x:canvas.width/2+(Math.random()-0.5)*300, y:canvas.height/2+(Math.random()-0.5)*300, vx:(Math.random()-0.5)*15, vy:(Math.random()-0.5)*20-5, life:1, decay:Math.random()*0.008+0.003, color:colors[Math.floor(Math.random()*colors.length)], width:Math.random()*15+10, height:Math.random()*15+10, gravity:0.3, friction:0.95, rotation:Math.random()*360, rotSpeed:(Math.random()-0.5)*20 });
    }
    if (!animFrameRef.current) updateParticles();
  }, [updateParticles]);

  // ---- Cell ref map (for particle positions) ----
  const cellRefs = useRef({});
  const getCellXY = (r, c) => {
    const el = cellRefs.current[`${r},${c}`];
    if (!el) return { x: window.innerWidth/2, y: window.innerHeight/2 };
    const rect = el.getBoundingClientRect();
    return { x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
  };

  // ---- Fact system ----
  const clearFactsTimer = useCallback(() => {
    clearTimeout(factTimerRef.current);
    setFactVisible(false);
  }, []);

  const scheduleNextFact = useCallback(() => {
    clearTimeout(factTimerRef.current);
    factTimerRef.current = setTimeout(() => {
      if (gameStatusRef.current !== "playing") return;
      setGameStatus("paused");
      setFace("🤔");
      setCurrentFact(educationalFacts[Math.floor(Math.random() * educationalFacts.length)]);
      setFactVisible(true);
      playSound("pop", mutedRef.current);
    }, 15000);
  }, []);

  const resumeFromFact = useCallback(() => {
    setFactVisible(false);
    setGameStatus("playing");
    setFace("😎");
    playSound("click", mutedRef.current);
    scheduleNextFact();
  }, [scheduleNextFact]);

  // ---- Core board actions ----
  const addCellAnim = (r, c, cls) => {
    const key = `${r},${c}`;
    setCellAnims(prev => ({ ...prev, [key]: cls }));
    setTimeout(() => setCellAnims(prev => { const n = { ...prev }; delete n[key]; return n; }), 500);
  };

  // Reveals using BFS on a COPY of board, returns new board + new revealedCount
  const bfsReveal = useCallback((brd, rows, cols, startR, startC, isChord) => {
    const nb = brd.map(r => r.map(c => ({ ...c })));
    let newRevealed = 0;
    const queue = [{ r: startR, c: startC, dist: 0 }];
    const visited = new Set([`${startR},${startC}`]);
    const reveals = []; // { r, c, dist }

    while (queue.length > 0) {
      const { r, c, dist } = queue.shift();
      const cell = nb[r][c];
      if (cell.isFlagged || cell.isRevealed) continue;
      cell.isRevealed = true;
      newRevealed++;
      reveals.push({ r, c, dist });
      if (cell.neighborMines === 0) {
        DIRS.forEach(([dr, dc]) => {
          const nr = r+dr, nc = c+dc;
          if (nr>=0 && nr<rows && nc>=0 && nc<cols) {
            const key = `${nr},${nc}`;
            if (!visited.has(key) && !nb[nr][nc].isRevealed && !nb[nr][nc].isMine) {
              visited.add(key); queue.push({ r: nr, c: nc, dist: dist+1 });
            }
          }
        });
      }
    }

    // Trigger animations with delay
    const delayBase = 20;
    reveals.forEach(({ r, c, dist }) => {
      setTimeout(() => {
        addCellAnim(r, c, "anim-pop");
        if (!isChord && dist > 0 && dist % 4 === 0) playSound("pop", mutedRef.current);
      }, dist * delayBase);
    });

    return { newBoard: nb, newRevealed };
  }, []);

  const checkWinState = useCallback((brd, cfg, revealed, status) => {
    if (status !== "playing") return;
    const totalSafe = cfg.rows * cfg.cols - cfg.mines;
    if (revealed === totalSafe) {
      setGameStatus("won");
      clearFactsTimer();
      setFace("🤩");
      addCellAnim(-1, -1, "anim-rubber-face");
      playSound("win", mutedRef.current);
      // Mark unflagged mines as stars
      setBoard(prev => prev.map(row => row.map(cell => {
        if (cell.isMine && !cell.isFlagged) return { ...cell, isFlagged: true, isWinStar: true };
        return cell;
      })));
      setMinesLeft(0);
      setTimeout(spawnConfetti, 200);
    }
  }, [clearFactsTimer, spawnConfetti]);

  const doRevealCell = useCallback((r, c, isChord = false) => {
    const currentBoard = boardRef.current;
    const currentConfig = configRef.current;
    const cell = currentBoard[r][c];
    if (cell.isRevealed || cell.isFlagged) return;

    let workingBoard = currentBoard;

    if (firstClickRef.current) {
      firstClickRef.current = false;
      setFirstClick(false);
      workingBoard = placeMinesOnBoard(currentBoard, currentConfig.rows, currentConfig.cols, currentConfig.mines, r, c);
    }

    const freshCell = workingBoard[r][c];
    if (freshCell.isMine) {
      // Game over
      setGameStatus("lost");
      clearFactsTimer();
      setFace("😵");
      playSound("explosion", mutedRef.current);
      setShakeScreen(true); setTimeout(() => setShakeScreen(false), 600);
      setFlash(true); setTimeout(() => setFlash(false), 200);

      const { x, y } = getCellXY(r, c);
      spawnExplosion(x, y);

      // Mark hit mine and reveal all others
      const nb = workingBoard.map((row, ri) => row.map((cell, ci) => {
        if (ri === r && ci === c) return { ...cell, isRevealed: true, isHitMine: true };
        if (cell.isMine && !cell.isFlagged && !(ri === r && ci === c)) return { ...cell, pendingReveal: true };
        if (!cell.isMine && cell.isFlagged) return { ...cell, isWrongFlag: true };
        return cell;
      }));

      // Cascade mine reveals with delay
      const mines = [];
      for (let rr = 0; rr < currentConfig.rows; rr++) {
        for (let cc = 0; cc < currentConfig.cols; cc++) {
          if (nb[rr][cc].pendingReveal) {
            const d = Math.hypot(rr - r, cc - c);
            mines.push({ r: rr, c: cc, d });
          }
        }
      }
      mines.sort((a, b) => a.d - b.d);
      mines.forEach((m, idx) => {
        setTimeout(() => {
          setBoard(prev => prev.map((row, ri) => row.map((cell, ci) => {
            if (ri === m.r && ci === m.c) return { ...cell, isRevealed: true, pendingReveal: false };
            return cell;
          })));
          addCellAnim(m.r, m.c, "anim-pop");
          if (idx % 4 === 0) playSound("pop", mutedRef.current);
        }, idx * (1200 / Math.max(1, mines.length)));
      });

      setBoard(nb);
      return;
    }

    if (!isChord) {
      playSound("click", mutedRef.current);
      const { x, y } = getCellXY(r, c);
      spawnDust(x, y);
    }

    const { newBoard, newRevealed } = bfsReveal(workingBoard, currentConfig.rows, currentConfig.cols, r, c, isChord);
    setBoard(newBoard);
    const totalRevealed = revealedCountRef.current + newRevealed;
    setRevealedCount(totalRevealed);
    revealedCountRef.current = totalRevealed;

    setTimeout(() => checkWinState(newBoard, currentConfig, totalRevealed, "playing"), 200);
  }, [bfsReveal, clearFactsTimer, checkWinState, spawnDust, spawnExplosion]);

  const doToggleFlag = useCallback((r, c) => {
    const cell = boardRef.current[r][c];
    if (cell.isRevealed) return;
    if (cell.isFlagged) {
      playSound("unflag", mutedRef.current);
      setBoard(prev => prev.map((row, ri) => row.map((cl, ci) => ri===r&&ci===c ? {...cl, isFlagged: false} : cl)));
      setMinesLeft(prev => { minesLeftRef.current = prev+1; return prev+1; });
    } else {
      if (minesLeftRef.current <= 0) return;
      playSound("flag", mutedRef.current);
      setBoard(prev => prev.map((row, ri) => row.map((cl, ci) => ri===r&&ci===c ? {...cl, isFlagged: true} : cl)));
      addCellAnim(r, c, "anim-pop");
      const { x, y } = getCellXY(r, c);
      spawnDust(x, y);
      setMinesLeft(prev => { minesLeftRef.current = prev-1; return prev-1; });
    }
  }, [spawnDust]);

  const doChord = useCallback((r, c) => {
    const cell = boardRef.current[r][c];
    if (!cell.isRevealed || cell.neighborMines === 0) return;
    const cfg = configRef.current;
    let flagCount = 0, hidden = [];
    DIRS.forEach(([dr, dc]) => {
      const nr = r+dr, nc = c+dc;
      if (nr>=0 && nr<cfg.rows && nc>=0 && nc<cfg.cols) {
        if (boardRef.current[nr][nc].isFlagged) flagCount++;
        else if (!boardRef.current[nr][nc].isRevealed) hidden.push([nr, nc]);
      }
    });
    if (flagCount === cell.neighborMines) {
      playSound("chord", mutedRef.current);
      addCellAnim(r, c, "anim-rubber");
      hidden.forEach(([nr, nc]) => doRevealCell(nr, nc, true));
    }
  }, [doRevealCell]);

  // ---- Start / Reset Game ----
  const startGame = useCallback(() => {
    initAudio();
    let rows, cols, mines;
    if (difficulty === "easy") { rows=9; cols=9; mines=10; }
    else if (difficulty === "medium") { rows=16; cols=16; mines=40; }
    else if (difficulty === "hard") { rows=24; cols=24; mines=99; }
    else {
      rows = Math.max(5, Math.min(30, parseInt(customRows)||10));
      cols = Math.max(5, Math.min(30, parseInt(customCols)||10));
      const maxMines = rows * cols - 9;
      mines = Math.max(1, Math.min(maxMines, parseInt(customMines)||15));
    }

    // Responsive cell size
    const maxW = window.innerWidth * 0.85;
    let cSize = 40;
    if (cols * 40 > maxW) cSize = Math.max(22, Math.floor(maxW / cols));
    document.documentElement.style.setProperty("--cell-size", `${cSize}px`);

    const cfg = { rows, cols, mines };
    setConfig(cfg); configRef.current = cfg;
    setBoard(createBoard(rows, cols));
    setGameStatus("playing"); gameStatusRef.current = "playing";
    setMinesLeft(mines); minesLeftRef.current = mines;
    setRevealedCount(0); revealedCountRef.current = 0;
    setFirstClick(true); firstClickRef.current = true;
    setFace("😎");
    setCellAnims({});
    particlesRef.current = [];
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null; }
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    clearFactsTimer();
    setScreen("game");
    scheduleNextFact();
  }, [difficulty, customRows, customCols, customMines, clearFactsTimer, scheduleNextFact]);

  const resetGame = useCallback(() => {
    clearFactsTimer();
    const cfg = configRef.current;
    setBoard(createBoard(cfg.rows, cfg.cols));
    setGameStatus("playing"); gameStatusRef.current = "playing";
    setMinesLeft(cfg.mines); minesLeftRef.current = cfg.mines;
    setRevealedCount(0); revealedCountRef.current = 0;
    setFirstClick(true); firstClickRef.current = true;
    setFace("😎");
    setCellAnims({});
    particlesRef.current = [];
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null; }
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    scheduleNextFact();
  }, [clearFactsTimer, scheduleNextFact]);

  const showMenu = useCallback(() => {
    clearFactsTimer();
    setScreen("menu");
    setGameStatus("menu");
    setShakeScreen(false);
  }, [clearFactsTimer]);

  // ---- Touch handlers ----
  const handleTouchStart = useCallback((e, r, c) => {
    if (e.touches.length > 1 || gameStatusRef.current !== "playing") return;
    touchMovedRef.current = false;
    if (!boardRef.current[r][c].isRevealed) setFace("😲");
    touchTimerRef.current = setTimeout(() => {
      if (!touchMovedRef.current) {
        navigator.vibrate && navigator.vibrate(50);
        doToggleFlag(r, c);
        touchTimerRef.current = null;
      }
    }, 300);
  }, [doToggleFlag]);

  const handleTouchEnd = useCallback((e, r, c) => {
    if (gameStatusRef.current === "playing") setFace("😎");
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
      if (!touchMovedRef.current && gameStatusRef.current === "playing") {
        if (boardRef.current[r][c].isRevealed) doChord(r, c);
        else doRevealCell(r, c);
      }
    }
    e.preventDefault();
  }, [doChord, doRevealCell]);

  // ---- Cell rendering ----
  const getCellContent = (cell) => {
    if (cell.isHitMine) return "💣";
    if (cell.isWinStar) return "🌟";
    if (cell.isFlagged) return "🚩";
    if (cell.isWrongFlag) return "❌";
    if (cell.pendingReveal) return null;
    if (cell.isRevealed && cell.neighborMines > 0) return cell.neighborMines;
    if (cell.isRevealed && cell.isMine) return "💣";
    return null;
  };

  const getCellClass = (cell, r, c) => {
    const key = `${r},${c}`;
    let cls = "cell";
    if (cell.isRevealed || cell.pendingReveal) cls += " revealed";
    if (cell.isMine && (cell.isRevealed || cell.pendingReveal)) cls += " mine";
    if (cell.isHitMine) cls += " mine hit-mine";
    if (cell.isFlagged || cell.isWinStar || cell.isWrongFlag) cls += " flagged";
    if (cell.isWrongFlag) cls += " wrong-flag";
    if (cell.isRevealed && cell.neighborMines > 0) cls += ` num num-${cell.neighborMines}`;
    if (cellAnims[key]) cls += ` ${cellAnims[key]}`;
    return cls;
  };

  return (
    <div id="ms-root">
      <canvas ref={canvasRef} id="effects-canvas" />
      <div className={`flash-overlay${flash ? " active" : ""}`} />

      {/* ===== Menu Screen ===== */}
      <div className={`ms-screen${screen === "menu" ? " active" : ""}`} id="menu-screen">
        <div className="menu-panel">
          <h1 className="menu-title">KIDS<br />MINESWEEPER</h1>
          <div className="btn-group">
            {[["easy","Beginner (9x9, 10 Mines)"],["medium","Intermediate (16x16, 40 Mines)"],["hard","Expert (24x24, 99 Mines)"],["custom","Custom Setup"]].map(([d, label]) => (
              <button key={d} className={`btn${difficulty===d?" active-btn":""}`} data-diff={d} onClick={() => setDifficulty(d)}>{label}</button>
            ))}
          </div>
          <div className={`custom-inputs${difficulty==="custom"?" show":""}`}>
            <input type="number" className="custom-input" placeholder="Rows" min="5" max="30" value={customRows} onChange={e=>setCustomRows(e.target.value)} />
            <input type="number" className="custom-input" placeholder="Cols" min="5" max="30" value={customCols} onChange={e=>setCustomCols(e.target.value)} />
            <input type="number" className="custom-input" placeholder="Mines" min="1" max="900" value={customMines} onChange={e=>setCustomMines(e.target.value)} />
          </div>
          <button className="btn start-btn" onClick={startGame}>START GAME 🚀</button>
          <div style={{ marginTop: 20 }}>
            <button className="btn" style={{ padding: 10, fontSize: "1rem" }} onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}>☀️ / 🌙 Toggle Theme</button>
          </div>
        </div>
      </div>

      {/* ===== Game Screen ===== */}
      <div className={`ms-screen${screen === "game" ? " active" : ""}`} id="game-screen">
        <div className={`game-wrapper${shakeScreen?" shake-screen":""}`}>
          <div className="top-bar">
            <div style={{ flex: 1, display: "flex", justifyContent: "flex-start" }}>
              <div className="lcd-text" title="Mines Remaining">{Math.max(0, minesLeft).toString().padStart(3, "0")}</div>
            </div>
            <button className="face-btn anim-pop" onClick={resetGame}>{face}</button>
            <div style={{ flex: 1 }} />
          </div>

          <div className="board-scroll-container">
            <div className="grid" style={{ gridTemplateColumns: `repeat(${config.cols}, 1fr)` }}>
              {board.map((row, r) =>
                row.map((cell, c) => (
                  <div
                    key={`${r},${c}`}
                    ref={el => { if (el) cellRefs.current[`${r},${c}`] = el; }}
                    className={getCellClass(cell, r, c)}
                    onMouseDown={e => { if (e.button===0 && gameStatusRef.current==="playing" && !cell.isRevealed) setFace("😲"); }}
                    onMouseUp={e => {
                      if (gameStatusRef.current === "playing") setFace("😎");
                      if (gameStatusRef.current !== "playing") return;
                      if (e.button === 2) doToggleFlag(r, c);
                      else if (e.button === 0) {
                        if (cell.isRevealed) { if (window.innerWidth <= 768) doChord(r, c); }
                        else doRevealCell(r, c);
                      }
                    }}
                    onDoubleClick={() => { if (gameStatusRef.current === "playing") doChord(r, c); }}
                    onContextMenu={e => e.preventDefault()}
                    onTouchStart={e => handleTouchStart(e, r, c)}
                    onTouchMove={() => { touchMovedRef.current = true; }}
                    onTouchEnd={e => handleTouchEnd(e, r, c)}
                  >
                    {getCellContent(cell)}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="controls">
            <button className="icon-btn" title="Back to Menu" onClick={showMenu}>🏠</button>
            <span className="pro-tip">TIP: Dbl-Click revealed numbers!</span>
            <button className="icon-btn" onClick={() => { setMuted(m => { mutedRef.current = !m; return !m; }) }}>
              {muted ? "🔇" : "🔊"}
            </button>
          </div>
        </div>
      </div>

      {/* ===== Educational Fact Modal ===== */}
      <div className={`fact-overlay${factVisible?" show":""}`}>
        <div className="fact-modal">
          <span className="fact-title">🌍 Did You Know?</span>
          <div className="fact-text">{currentFact}</div>
          <button className="fact-resume-btn" onClick={resumeFromFact}>Wow! Resume Game 🚀</button>
        </div>
      </div>
    </div>
  );
}