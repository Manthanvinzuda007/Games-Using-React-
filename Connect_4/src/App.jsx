// By Manthan Vinzuda
import React, { useState, useRef, useCallback } from 'react';

// ==========================================
// 1. STYLES (Zero Dependencies - Pure CSS)
// ==========================================
const Styles = () => (
  <style>{`
    /* CSS Variables from original */
    :root {
      --board-bg: #2563eb;
      --slot-bg: #1e3a8a;
      --player1-color: #ef4444;
      --player2-color: #facc15;
      --player1-shadow: #b91c1c;
      --player2-shadow: #ca8a04;
      --bg-color: #0f172a;
    }

    /* Base Reset & App Layout */
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: var(--bg-color);
      color: white;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      overflow-x: hidden;
      touch-action: manipulation;
    }

    .app-container {
      min-height: 100vh;
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      background-color: var(--bg-color);
    }

    /* Top Mute Button */
    .mute-btn {
      position: fixed;
      top: 1rem;
      right: 1rem;
      z-index: 50;
      padding: 0.75rem;
      background-color: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 9999px;
      cursor: pointer;
      color: white;
      transition: background-color 0.2s;
    }
    .mute-btn:hover {
      background-color: rgba(255, 255, 255, 0.2);
    }

    /* Header */
    .header-container {
      text-align: center;
      margin-bottom: 2rem;
    }
    .game-title {
      font-size: 2.5rem;
      font-weight: 900;
      letter-spacing: -0.05em;
      margin-bottom: 0.5rem;
      background: linear-gradient(to right, #60a5fa, #6366f1);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      text-transform: uppercase;
    }
    @media (min-width: 768px) {
      .game-title { font-size: 3.75rem; }
    }
    .status-display {
      font-size: 1.25rem;
      font-weight: 500;
      opacity: 0.9;
      height: 2rem;
    }

    /* Utilities */
    .text-red { color: #ef4444; }
    .text-yellow { color: #facc15; }
    .text-gray { color: #6b7280; }

    /* Scoreboard */
    .scoreboard {
      display: flex;
      gap: 2rem;
      margin-bottom: 1.5rem;
      font-size: 0.875rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }
    .score-col {
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .score-col span:first-child {
      margin-bottom: 0.25rem;
    }
    .score-val {
      font-size: 1.5rem;
    }

    /* Game Board Original CSS */
    .board-wrapper {
      position: relative;
      width: 100%;
      display: flex;
      justify-content: center;
      perspective: 1000px;
    }
    .board {
      background-color: var(--board-bg);
      border: 8px solid #1d4ed8;
      border-radius: 12px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2), inset 0 2px 4px 0 rgba(255, 255, 255, 0.1);
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 8px;
      padding: 12px;
      width: 100%;
      max-width: 500px;
      margin: 0 auto;
      cursor: pointer;
    }
    .slot {
      aspect-ratio: 1 / 1;
      background-color: var(--slot-bg);
      border-radius: 50%;
      position: relative;
      overflow: hidden;
      box-shadow: inset 0 4px 6px -1px rgba(0, 0, 0, 0.5);
    }
    .token {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      border-radius: 50%;
      transition: transform 0.5s cubic-bezier(0.45, 0.05, 0.55, 0.95);
      z-index: 10;
    }
    .token.red {
      background: radial-gradient(circle at 30% 30%, var(--player1-color), var(--player1-shadow));
      box-shadow: 0 4px 0 var(--player1-shadow);
    }
    .token.yellow {
      background: radial-gradient(circle at 30% 30%, var(--player2-color), var(--player2-shadow));
      box-shadow: 0 4px 0 var(--player2-shadow);
    }

    /* Animations */
    .falling {
      animation: drop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
    }
    @keyframes drop {
      0% { transform: translateY(-500%); }
      100% { transform: translateY(0); }
    }
    .win-highlight {
      animation: pulse 1s infinite alternate;
      z-index: 20;
      border: 4px solid white;
    }
    @keyframes pulse {
      from { transform: scale(1); box-shadow: 0 0 0px white; }
      to { transform: scale(1.1); box-shadow: 0 0 20px white; }
    }

    @media (max-width: 480px) {
      .board {
        gap: 4px;
        padding: 6px;
        border-width: 4px;
      }
    }

    /* Controls */
    .controls {
      margin-top: 2rem;
      display: flex;
      gap: 1rem;
    }
    .btn {
      padding: 0.5rem 1.5rem;
      background-color: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 9999px;
      color: white;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 0.75rem;
      letter-spacing: 0.1em;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn:hover {
      background-color: rgba(255, 255, 255, 0.2);
    }

    /* Overlay Modal */
    .overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
      transition: opacity 0.3s ease;
      opacity: 0;
      pointer-events: none;
    }
    .overlay.show {
      opacity: 1;
      pointer-events: auto;
    }
    .modal {
      background-color: #1e293b;
      padding: 2rem;
      border-radius: 1rem;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      border: 1px solid rgba(255, 255, 255, 0.1);
      transform: scale(0.95);
      transition: transform 0.3s ease;
    }
    .overlay.show .modal {
      transform: scale(1);
    }
    .win-msg {
      font-size: 1.875rem;
      font-weight: 700;
      margin-bottom: 1rem;
    }
    .play-again-btn {
      padding: 0.75rem 2rem;
      background-color: #2563eb;
      color: white;
      border: none;
      border-radius: 0.75rem;
      font-weight: 700;
      font-size: 1rem;
      cursor: pointer;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
      transition: background-color 0.2s;
    }
    .play-again-btn:hover {
      background-color: #3b82f6;
    }
  `}</style>
);

// ==========================================
// 2. SOUND ENGINE HOOK
// ==========================================
const useSoundEngine = () => {
  const ctxRef = useRef(null);
  const mutedRef = useRef(false);
  const [isMuted, setIsMuted] = useState(false);

  const init = useCallback(() => {
    if (ctxRef.current) return;
    ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
  }, []);

  const createNoiseBuffer = useCallback(() => {
    if (!ctxRef.current) return null;
    const ctx = ctxRef.current;
    const bufferSize = ctx.sampleRate * 0.1;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }, []);

  const playDrop = useCallback((row) => {
    if (mutedRef.current) return;
    init();
    const ctx = ctxRef.current;
    if (!ctx) return;
    
    const now = ctx.currentTime;
    
    // 1. The "Thud"
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const lowFreq = 120 - (row * 8);
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(lowFreq, now);
    osc.frequency.exponentialRampToValueAtTime(20, now + 0.15);
    
    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.2);

    // 2. The "Clack"
    const noise = ctx.createBufferSource();
    const buffer = createNoiseBuffer();
    if (buffer) noise.buffer = buffer;
    const noiseFilter = ctx.createBiquadFilter();
    const noiseGain = ctx.createGain();

    noiseFilter.type = 'highpass';
    noiseFilter.frequency.setValueAtTime(1500, now);
    
    noiseGain.gain.setValueAtTime(0.15, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
  }, [init, createNoiseBuffer]);

  const playWin = useCallback(() => {
    if (mutedRef.current || !ctxRef.current) return;
    const ctx = ctxRef.current;
    const now = ctx.currentTime;
    
    const playPureNote = (freq, start, duration, volume = 0.1) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(volume, start + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration);
    };

    playPureNote(329.63, now, 1.0); 
    playPureNote(392.00, now + 0.1, 1.0); 
    playPureNote(523.25, now + 0.2, 1.2); 
    playPureNote(659.25, now + 0.3, 1.5, 0.08); 
  }, []);

  const playDraw = useCallback(() => {
    if (mutedRef.current || !ctxRef.current) return;
    const ctx = ctxRef.current;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.linearRampToValueAtTime(110, now + 0.6);
    
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.6);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(now + 0.6);
  }, []);

  const playClick = useCallback(() => {
    if (mutedRef.current) return;
    init();
    const ctx = ctxRef.current;
    if (!ctx) return;
    
    const now = ctx.currentTime;
    const noise = ctx.createBufferSource();
    const buffer = createNoiseBuffer();
    if (buffer) noise.buffer = buffer;
    
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2000, now);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
  }, [init, createNoiseBuffer]);

  const toggleMute = useCallback(() => {
    init();
    mutedRef.current = !mutedRef.current;
    setIsMuted(mutedRef.current);
    if (!mutedRef.current) {
      setTimeout(() => playClick(), 10);
    }
  }, [init, playClick]);

  return { init, playDrop, playWin, playDraw, playClick, toggleMute, isMuted };
};

// ==========================================
// 3. GAME LOGIC HOOK
// ==========================================
const ROWS = 6;
const COLS = 7;

const useConnect4 = (sounds) => {
  const [board, setBoard] = useState(Array(ROWS).fill().map(() => Array(COLS).fill(0)));
  const [currentPlayer, setCurrentPlayer] = useState(1);
  const [gameActive, setGameActive] = useState(true);
  const [scores, setScores] = useState({ 1: 0, 2: 0, draw: 0 });
  const [winningCells, setWinningCells] = useState([]);
  const [showOverlay, setShowOverlay] = useState(false);
  const [winMessage, setWinMessage] = useState(null);
  const [gameStatus, setGameStatus] = useState({ state: 'playing', player: 1 });

  const checkWin = useCallback((row, col, player, currentBoard) => {
    const directions = [
      [[0, 1], [0, -1]], // Horizontal
      [[1, 0], [-1, 0]], // Vertical
      [[1, 1], [-1, -1]], // Diagonal 1
      [[1, -1], [-1, 1]]  // Diagonal 2
    ];

    for (const dir of directions) {
      let count = 1;
      let winningTokens = [[row, col]];

      for (const [dr, dc] of dir) {
        let r = row + dr;
        let c = col + dc;
        while (r >= 0 && r < ROWS && c >= 0 && c < COLS && currentBoard[r][c] === player) {
          count++;
          winningTokens.push([r, c]);
          r += dr;
          c += dc;
        }
      }

      if (count >= 4) return winningTokens;
    }
    return null;
  }, []);

  const endGame = useCallback((winner, tokens = []) => {
    setGameActive(false);
    
    if (winner === 0) {
      setScores(prev => ({ ...prev, draw: prev.draw + 1 }));
      setWinMessage({ text: "It's a Draw!", winner: 0 });
      setGameStatus({ state: 'draw', player: 0 });
      sounds.playDraw();
    } else {
      setScores(prev => ({ ...prev, [winner]: prev[winner] + 1 }));
      setWinMessage({ text: `Player ${winner} Wins!`, winner });
      setGameStatus({ state: 'won', player: winner });
      setWinningCells(tokens);
      sounds.playWin();
    }

    setTimeout(() => {
      setShowOverlay(true);
    }, 800);
  }, [sounds]);

  const handleMove = useCallback((col) => {
    sounds.init();
    if (!gameActive) return;

    let row = -1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r][col] === 0) {
        row = r;
        break;
      }
    }

    if (row === -1) return;

    const newBoard = board.map(r => [...r]);
    newBoard[row][col] = currentPlayer;
    setBoard(newBoard);

    sounds.playDrop(row);

    const winResult = checkWin(row, col, currentPlayer, newBoard);
    if (winResult) {
      endGame(currentPlayer, winResult);
      return;
    }

    if (newBoard.every(r => r.every(cell => cell !== 0))) {
      endGame(0);
      return;
    }

    const nextPlayer = currentPlayer === 1 ? 2 : 1;
    setCurrentPlayer(nextPlayer);
    setGameStatus({ state: 'playing', player: nextPlayer });
  }, [board, currentPlayer, gameActive, checkWin, endGame, sounds]);

  const resetGame = useCallback((fullReset = false) => {
    sounds.playClick();
    setGameActive(true);
    setCurrentPlayer(1);
    setShowOverlay(false);
    setWinningCells([]);
    setBoard(Array(ROWS).fill().map(() => Array(COLS).fill(0)));
    setGameStatus({ state: 'playing', player: 1 });
    
    if (fullReset) {
      setScores({ 1: 0, 2: 0, draw: 0 });
    }
  }, [sounds]);

  return { board, scores, winningCells, showOverlay, winMessage, gameStatus, handleMove, resetGame };
};

// ==========================================
// 4. MAIN COMPONENTS
// ==========================================

export default function App() {
  const sounds = useSoundEngine();
  const { board, scores, winningCells, showOverlay, winMessage, gameStatus, handleMove, resetGame } = useConnect4(sounds);

  return (
    <div className="app-container">
      <Styles />

      {/* Mute Button */}
      <button onClick={sounds.toggleMute} className="mute-btn" title="Toggle Sound">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {sounds.isMuted ? (
            <>
              <path d="M11 5L6 9H2v6h4l5 4V5z" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </>
          ) : (
            <>
              <path d="M11 5L6 9H2v6h4l5 4V5z" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
            </>
          )}
        </svg>
      </button>

      {/* Header Area */}
      <div className="header-container">
        <h1 className="game-title">Connect Four</h1>
        <div className="status-display">
          {gameStatus.state === 'playing' && (
            <span>Player <span className={gameStatus.player === 1 ? 'text-red' : 'text-yellow'}>{gameStatus.player}</span>'s Turn</span>
          )}
          {gameStatus.state === 'won' && <span>Player {gameStatus.player} won the round!</span>}
          {gameStatus.state === 'draw' && <span>Draw Game</span>}
        </div>
      </div>
      
      {/* Scoreboard Area */}
      <div className="scoreboard">
        <div className="score-col">
          <span className="text-red">Player 1</span>
          <span className="score-val">{scores[1]}</span>
        </div>
        <div className="score-col">
          <span className="text-gray">Draws</span>
          <span className="score-val">{scores.draw}</span>
        </div>
        <div className="score-col">
          <span className="text-yellow">Player 2</span>
          <span className="score-val">{scores[2]}</span>
        </div>
      </div>

      {/* Game Board */}
      <div className="board-wrapper">
        <div className="board" onClick={sounds.init}>
          {board.map((rowArr, r) =>
            rowArr.map((cellValue, c) => {
              const isWinningCell = winningCells.some(([winR, winC]) => winR === r && winC === c);
              return (
                <div key={`${r}-${c}`} className="slot" onClick={() => handleMove(c)}>
                  {cellValue !== 0 && (
                    <div className={`token ${cellValue === 1 ? 'red' : 'yellow'} falling ${isWinningCell ? 'win-highlight' : ''}`} />
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="controls">
        <button onClick={() => resetGame(true)} className="btn">
          Reset Game
        </button>
      </div>

      {/* Overlay Modal */}
      {winMessage && (
        <div className={`overlay ${showOverlay ? 'show' : ''}`}>
          <div className="modal">
            <h2 className="win-msg">
              {winMessage.winner === 1 && <span>Player <span className="text-red">1</span> Wins!</span>}
              {winMessage.winner === 2 && <span>Player <span className="text-yellow">2</span> Wins!</span>}
              {winMessage.winner === 0 && <span>It's a Draw!</span>}
            </h2>
            <button onClick={() => resetGame(false)} className="play-again-btn">
              Play Again
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
