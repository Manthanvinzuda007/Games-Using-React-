// By Manthan Vinzuda 
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

// ==========================================
// Constants & Utilities
// ==========================================
const WHITE = 1;
const BLACK = 2;
const EMPTY = 0;

// Reusable audio utility replacing direct AudioContext calls
const SFX = {
  ctx: null,
  play(f, d, v) {
    try {
      if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(f, this.ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(20, this.ctx.currentTime + d);
      g.gain.setValueAtTime(v, this.ctx.currentTime);
      g.gain.linearRampToValueAtTime(0, this.ctx.currentTime + d);
      o.connect(g);
      g.connect(this.ctx.destination);
      o.start();
      o.stop(this.ctx.currentTime + d);
    } catch (e) {
      console.warn("Audio play failed, user interaction may be required.");
    }
  },
  move() { this.play(160, 0.1, 0.2); },
  king() { this.play(440, 0.4, 0.2); },
  error() { this.play(100, 0.1, 0.1); }
};

const getGrid = (pieces) => {
  const grid = Array(8).fill(null).map(() => Array(8).fill(EMPTY));
  pieces.forEach(p => grid[p.r][p.c] = p.val);
  return grid;
};

// SVG Assets
const CrownIcon = () => (
  <svg className="w-3/5 h-3/5 fill-current text-brass drop-shadow-md" viewBox="0 0 24 24">
    <path d="M5 16L3 5L8.5 10L12 4L15.5 10L21 5L19 16H5M19 19C19 19.6 18.6 20 18 20H6C5.4 20 5 19.6 5 19V18H19V19Z" />
  </svg>
);

const HistoryIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ThemeIcon = ({ dark }) => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    {dark ? (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    ) : (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    )}
  </svg>
);

// ==========================================
// Custom Hooks
// ==========================================
function useTimer(turn, gameOver, isGameOverState) {
  const [timers, setTimers] = useState({ [WHITE]: 300, [BLACK]: 300 });

  useEffect(() => {
    if (isGameOverState) return;
    const interval = setInterval(() => {
      setTimers(prev => {
        const next = { ...prev, [turn]: prev[turn] - 1 };
        if (next[turn] <= 0) {
          gameOver(turn === WHITE ? BLACK : WHITE, "Time Out!");
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [turn, isGameOverState, gameOver]);

  return { timers, setTimers };
}

function useGameLogic() {
  const [pieces, setPieces] = useState([]);
  const [turn, setTurn] = useState(WHITE);
  const [selected, setSelected] = useState(null);
  const [validMoves, setValidMoves] = useState([]);
  const [lastMove, setLastMove] = useState(null);
  const [mustJumpPiece, setMustJumpPiece] = useState(null);
  const [history, setHistory] = useState([]);
  const [gameState, setGameState] = useState({ isOver: false, winner: null, reason: "" });

  const initGame = useCallback(() => {
    const initialPieces = [];
    let idCounter = 0;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 8; c++) {
        if ((r + c) % 2 !== 0) initialPieces.push({ id: idCounter++, r, c, val: BLACK });
      }
    }
    for (let r = 5; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if ((r + c) % 2 !== 0) initialPieces.push({ id: idCounter++, r, c, val: WHITE });
      }
    }
    setPieces(initialPieces);
    setTurn(WHITE);
    setSelected(null);
    setValidMoves([]);
    setLastMove(null);
    setMustJumpPiece(null);
    setHistory([]);
    setGameState({ isOver: false, winner: null, reason: "" });
  }, []);

  const gameOver = useCallback((winner, reason) => {
    setGameState({ isOver: true, winner, reason });
  }, []);

  // Compute piece moves based on current grid state
  const getPieceMoves = useCallback((r, c, grid) => {
    const val = grid[r][c];
    if (val === EMPTY) return [];
    const moves = [];
    const isKing = val < 0;
    const player = Math.abs(val);

    const dirs = isKing ? [[1, 1], [1, -1], [-1, 1], [-1, -1]] :
      (player === WHITE ? [[-1, 1], [-1, -1]] : [[1, 1], [1, -1]]);

    dirs.forEach(([dr, dc]) => {
      const tr = r + dr, tc = c + dc;
      if (tr >= 0 && tr < 8 && tc >= 0 && tc < 8) {
        if (grid[tr][tc] === EMPTY) {
          moves.push({ fromR: r, fromC: c, toR: tr, toC: tc, isJump: false });
        } else if (Math.abs(grid[tr][tc]) !== player) {
          const jr = tr + dr, jc = tc + dc;
          if (jr >= 0 && jr < 8 && jc >= 0 && jc < 8 && grid[jr][jc] === EMPTY) {
            moves.push({ fromR: r, fromC: c, toR: jr, toC: jc, isJump: true, jumpR: tr, jumpC: tc });
          }
        }
      }
    });
    return moves;
  }, []);

  const getFilteredMoves = useCallback((r, c, grid, player) => {
    const allMoves = [];
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        if (Math.abs(grid[i][j]) === player) {
          allMoves.push(...getPieceMoves(i, j, grid));
        }
      }
    }
    const jumps = allMoves.filter(m => m.isJump);
    const pMoves = getPieceMoves(r, c, grid);
    return jumps.length > 0 ? pMoves.filter(m => m.isJump) : pMoves;
  }, [getPieceMoves]);

  const selectPiece = useCallback((r, c) => {
    if (gameState.isOver) return;
    const grid = getGrid(pieces);
    
    // Enforce chaining constraint
    if (mustJumpPiece) {
      if (mustJumpPiece.r !== r || mustJumpPiece.c !== c) {
        SFX.error();
        return; 
      }
    } else if (Math.abs(grid[r][c]) !== turn) {
      return; 
    }

    setSelected({ r, c });
    setValidMoves(getFilteredMoves(r, c, grid, turn));
    SFX.move();
  }, [gameState.isOver, pieces, mustJumpPiece, turn, getFilteredMoves]);

  const executeMove = useCallback((move) => {
    const { fromR, fromC, toR, toC, isJump, jumpR, jumpC } = move;
    
    let becameKing = false;
    let nextPieces = pieces.map(p => {
      if (p.r === fromR && p.c === fromC) {
        let newVal = p.val;
        // Check for promotion
        if (Math.abs(newVal) === WHITE && toR === 0 && newVal > 0) { newVal = -WHITE; becameKing = true; }
        if (Math.abs(newVal) === BLACK && toR === 7 && newVal > 0) { newVal = -BLACK; becameKing = true; }
        return { ...p, r: toR, c: toC, val: newVal };
      }
      return p;
    });

    if (isJump) {
      nextPieces = nextPieces.filter(p => !(p.r === jumpR && p.c === jumpC));
    }

    if (becameKing) SFX.king();
    else SFX.move();

    setPieces(nextPieces);
    setLastMove(move);

    // Record History notation
    const alpha = 'ABCDEFGH';
    const notation = `${alpha[fromC]}${8 - fromR} ${isJump ? 'x' : '-'} ${alpha[toC]}${8 - toR}`;
    setHistory(prev => [{ player: turn, notation }, ...prev]);

    const nextGrid = getGrid(nextPieces);
    
    // Multi-jump chaining logic
    if (isJump && !becameKing) {
      const chains = getPieceMoves(toR, toC, nextGrid).filter(m => m.isJump);
      if (chains.length > 0) {
        setMustJumpPiece({ r: toR, c: toC });
        setSelected({ r: toR, c: toC });
        setValidMoves(chains);
        return; // Keep same turn
      }
    }

    // Switch turns
    const nextTurn = turn === WHITE ? BLACK : WHITE;
    setTurn(nextTurn);
    setSelected(null);
    setValidMoves([]);
    setMustJumpPiece(null);

    // Check game over state for next player
    let movesLeft = false;
    let opponentHasPieces = false;
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        if (Math.abs(nextGrid[i][j]) === nextTurn) {
          opponentHasPieces = true;
          if (getPieceMoves(i, j, nextGrid).length > 0) movesLeft = true;
        }
      }
    }
    
    if (!opponentHasPieces || !movesLeft) {
      gameOver(turn, "No Moves Left!");
    }
  }, [pieces, turn, getPieceMoves, gameOver]);

  return {
    pieces, turn, selected, validMoves, lastMove, history, gameState,
    initGame, selectPiece, executeMove, gameOver, setGameState
  };
}

// ==========================================
// Components
// ==========================================
export default function App() {
  const [theme, setTheme] = useState('dark');
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  
  const {
    pieces, turn, selected, validMoves, lastMove, history, gameState,
    initGame, selectPiece, executeMove, gameOver
  } = useGameLogic();

  const { timers, setTimers } = useTimer(turn, gameOver, gameState.isOver);

  useEffect(() => {
    initGame();
  }, [initGame]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  const handleResetMatch = () => {
    initGame();
    setTimers({ [WHITE]: 300, [BLACK]: 300 });
    setShowConfirmReset(false);
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  // Keyboard accessibility helper for standard actions
  const onKeyDownSelect = (e, action) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      action();
    }
  };

  return (
    <div className={`theme-${theme} min-h-screen flex flex-col items-center justify-center font-sans overflow-x-hidden transition-colors duration-500`}>
      {/* Global CSS Injected */}
      <style>{`
        :root {
          --brass: #d4af37;
          --active-glow: #2ecc71;
        }
        .theme-dark {
          --bg-main: #000000;
          --bg-grad: none;
          --text-main: #dcb35c;
          --board-border: #3d2b1f;
          --board-outer: #1a110a;
          --wood-light: #eecda3;
          --wood-dark: #7a4a28;
          --card-bg: #2a1b12;
          --modal-bg: rgba(0,0,0,0.95);
        }
        .theme-light {
          --bg-main: #f0f0f0;
          --bg-grad: radial-gradient(circle at center, #ffffff 0%, #e0e0e0 100%);
          --text-main: #5a4315;
          --board-border: #6d4b31;
          --board-outer: #4a311a;
          --wood-light: #f5deb3;
          --wood-dark: #8b5a2b;
          --card-bg: #fffaf0;
          --modal-bg: rgba(255,255,255,0.95);
        }
        
        body {
          background: var(--bg-main);
          background-image: var(--bg-grad);
          color: var(--text-main);
          margin: 0;
          touch-action: manipulation;
        }

        .wood-cell {
          background-image: url('https://www.transparenttextures.com/patterns/wood-pattern.png');
          background-blend-mode: multiply;
        }

        .piece {
          box-shadow: 0 6px 0 rgba(0,0,0,0.4), 0 10px 20px rgba(0,0,0,0.5);
          transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        .piece::after {
          content: '';
          position: absolute;
          inset: 10%;
          border: 2px solid rgba(0,0,0,0.1);
          border-radius: 50%;
        }
        .piece.ivory { background: radial-gradient(circle at 30% 30%, #fff, #dcd7c0); }
        .piece.ebony { background: radial-gradient(circle at 30% 30%, #444, #111); }
        .piece.selected {
          transform: scale(1.1) translateY(-10px);
          z-index: 100;
          filter: brightness(1.2);
          border: 2px solid var(--active-glow);
        }

        .valid-pulse::before {
          content: '';
          position: absolute;
          width: 25%; height: 25%;
          background: var(--brass);
          border-radius: 50%;
          animation: pulse 1s infinite alternate;
        }

        @keyframes pulse {
          from { opacity: 0.4; transform: scale(1); }
          to { opacity: 1; transform: scale(1.4); }
        }
      `}</style>

      {/* Main Layout */}
      <div className="w-full max-w-6xl p-4 flex flex-col md:flex-row items-center justify-around gap-8">
        
        {/* Left Side: History & Player 2 */}
        <div className="flex flex-col gap-6 w-full md:w-64 items-center">
          <PlayerCard 
            num={2} 
            name="EBONY" 
            time={formatTime(timers[BLACK])} 
            isActive={turn === BLACK} 
          />
          
          <div className="hidden md:flex flex-col w-full bg-[var(--card-bg)] border-2 border-[var(--brass)] rounded-xl p-4 h-64 overflow-hidden shadow-lg">
            <h3 className="flex items-center justify-center gap-2 text-[var(--brass)] font-bold mb-2 border-b border-[var(--brass)] pb-2">
              <HistoryIcon /> MOVE HISTORY
            </h3>
            <div className="overflow-y-auto pr-2 space-y-1 text-sm font-mono">
              {history.length === 0 ? (
                <p className="text-center opacity-50 italic mt-4">No moves yet</p>
              ) : (
                history.map((h, i) => (
                  <div key={i} className={`flex justify-between ${h.player === WHITE ? 'text-gray-400' : 'text-gray-600 font-bold'}`}>
                    <span>{history.length - i}.</span>
                    <span>{h.notation}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Center: The Board */}
        <div className="board-wrapper p-2 bg-[var(--board-border)] border-[8px] border-[var(--board-outer)] rounded shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
          <div className="relative w-[90vw] h-[90vw] max-w-[480px] max-h-[480px] bg-black grid grid-cols-8 grid-rows-8 outline-none" role="grid">
            
            {/* 1. Render Cells (Backgrounds & Highlights) */}
            {Array.from({ length: 64 }).map((_, i) => {
              const r = Math.floor(i / 8);
              const c = i % 8;
              const isDark = (r + c) % 2 !== 0;
              const isValid = validMoves.find(m => m.toR === r && m.toC === c);
              const isLastSrc = lastMove?.fromR === r && lastMove?.fromC === c;
              const isLastDest = lastMove?.toR === r && lastMove?.toC === c;
              
              return (
                <div 
                  key={`cell-${r}-${c}`}
                  role="gridcell"
                  tabIndex={0}
                  className={`
                    w-full h-full relative flex items-center justify-center wood-cell cursor-pointer transition-colors
                    ${isDark ? 'bg-[var(--wood-dark)]' : 'bg-[var(--wood-light)]'}
                    ${isValid ? 'valid-pulse' : ''}
                    ${isLastSrc ? 'bg-black/20' : ''}
                    ${isLastDest ? 'bg-[var(--brass)]/30' : ''}
                    focus:outline-none focus:ring-4 focus:ring-inset focus:ring-[var(--active-glow)]
                  `}
                  onClick={() => isValid && executeMove(isValid)}
                  onKeyDown={(e) => isValid && onKeyDownSelect(e, () => executeMove(isValid))}
                />
              );
            })}

            {/* 2. Render Pieces (Absolute positioning for smooth CSS animation) */}
            {pieces.map(p => {
              const isSelected = selected?.r === p.r && selected?.c === p.c;
              const isWhite = Math.abs(p.val) === WHITE;
              const isKing = p.val < 0;
              
              return (
                <div
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  className={`
                    piece absolute rounded-full flex items-center justify-center cursor-pointer outline-none
                    ${isWhite ? 'ivory' : 'ebony'}
                    ${isSelected ? 'selected' : ''}
                    focus:ring-4 focus:ring-[var(--active-glow)] focus:ring-offset-2 focus:ring-offset-transparent
                  `}
                  style={{
                    width: '10.25%', // ~82% of a 12.5% cell
                    height: '10.25%',
                    left: `${(p.c * 12.5) + 1.125}%`,
                    top: `${(p.r * 12.5) + 1.125}%`,
                    zIndex: isSelected ? 100 : 10
                  }}
                  onClick={(e) => { e.stopPropagation(); selectPiece(p.r, p.c); }}
                  onKeyDown={(e) => onKeyDownSelect(e, () => selectPiece(p.r, p.c))}
                >
                  {isKing && <CrownIcon />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Player 1 & Controls */}
        <div className="flex flex-col gap-6 w-full md:w-64 items-center">
          <PlayerCard 
            num={1} 
            name="IVORY" 
            time={formatTime(timers[WHITE])} 
            isActive={turn === WHITE} 
          />
          
          <div className="flex flex-col gap-3 w-full max-w-[250px]">
            <button 
              className="flex items-center justify-center gap-2 bg-transparent text-[var(--brass)] border border-[var(--brass)] py-3 px-6 rounded-full uppercase font-bold tracking-widest hover:bg-[var(--brass)] hover:text-black transition-all"
              onClick={() => setShowConfirmReset(true)}
            >
              Reset Match
            </button>
            <button 
              className="flex items-center justify-center gap-2 bg-transparent text-[var(--text-main)] border border-current py-3 px-6 rounded-full uppercase font-bold tracking-widest hover:bg-[var(--text-main)] hover:text-[var(--bg-main)] transition-all opacity-70 hover:opacity-100"
              onClick={toggleTheme}
            >
              <ThemeIcon dark={theme === 'dark'} /> {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </button>
          </div>
        </div>

      </div>

      {/* Game Over Modal */}
      {gameState.isOver && (
        <Modal title={gameState.winner === WHITE ? "PLAYER 1 WINS!" : "PLAYER 2 WINS!"}>
          <p className="text-xl mb-8">{gameState.reason}</p>
          <button 
            className="bg-transparent text-[var(--brass)] border border-[var(--brass)] py-3 px-8 rounded-full uppercase font-bold tracking-widest hover:bg-[var(--brass)] hover:text-black transition-all"
            onClick={handleResetMatch}
          >
            Play Again
          </button>
        </Modal>
      )}

      {/* Confirm Reset Modal */}
      {showConfirmReset && !gameState.isOver && (
        <Modal title="RESET MATCH?">
          <p className="text-xl mb-8 opacity-80">Are you sure you want to start a new game?</p>
          <div className="flex gap-4 justify-center">
            <button 
              className="bg-transparent text-[var(--text-main)] border border-current py-2 px-6 rounded-full uppercase font-bold hover:bg-[var(--text-main)] hover:text-[var(--bg-main)] transition-all"
              onClick={() => setShowConfirmReset(false)}
            >
              Cancel
            </button>
            <button 
              className="bg-[var(--brass)] text-black border border-[var(--brass)] py-2 px-6 rounded-full uppercase font-bold hover:brightness-110 transition-all shadow-[0_0_15px_rgba(212,175,55,0.4)]"
              onClick={handleResetMatch}
            >
              Confirm
            </button>
          </div>
        </Modal>
      )}

    </div>
  );
}

// Subcomponents
function PlayerCard({ num, name, time, isActive }) {
  return (
    <div className={`
      relative w-[250px] p-4 text-center rounded-2xl transition-all duration-300 border-2
      ${isActive 
        ? 'border-[var(--active-glow)] shadow-[0_0_20px_rgba(46,204,113,0.4)] scale-105' 
        : 'border-[var(--brass)] shadow-lg scale-100'}
      bg-[var(--card-bg)]
    `}>
      <div className="font-bold text-lg tracking-widest mb-1 text-[var(--brass)]">PLAYER {num} ({name})</div>
      <div className="font-mono text-3xl font-bold tracking-wider">{time}</div>
      {isActive && (
        <div className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-[var(--active-glow)] shadow-[0_0_10px_var(--active-glow)] animate-pulse" />
      )}
    </div>
  );
}

function Modal({ title, children }) {
  return (
    <div className="fixed inset-0 bg-[var(--modal-bg)] backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-300 p-4">
      <div className="bg-[var(--card-bg)] p-8 border-2 border-[var(--brass)] text-center rounded-2xl shadow-2xl max-w-md w-full transform transition-all scale-100 animate-in zoom-in-95">
        <h2 className="text-[var(--brass)] text-4xl font-bold mt-0 mb-4 drop-shadow-md">{title}</h2>
        {children}
      </div>
    </div>
  );
}
