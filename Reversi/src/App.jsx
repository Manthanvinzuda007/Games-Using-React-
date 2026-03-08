import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  Play, 
  RotateCcw, 
  ChevronLeft, 
  LogOut, 
  User, 
  Cpu, 
  Trophy, 
  Handshake 
} from 'lucide-react';

// --- CONSTANTS ---
const EMPTY = 0, BLACK = 1, WHITE = 2;
const DIRS = [
  [-1, 0], [1, 0], [0, -1], [0, 1],
  [-1, -1], [-1, 1], [1, -1], [1, 1]
];

// Heuristics mapping for Hard Mode
const AI_WEIGHTS = [
  [ 50, -20,  10,   5,   5,  10, -20,  50],
  [-20, -30,  -5,  -5,  -5,  -5, -30, -20],
  [ 10,  -5,   5,   1,   1,   5,  -5,  10],
  [  5,  -5,   1,   1,   1,   1,  -5,   5],
  [  5,  -5,   1,   1,   1,   1,  -5,   5],
  [ 10,  -5,   5,   1,   1,   5,  -5,  10],
  [-20, -30,  -5,  -5,  -5,  -5, -30, -20],
  [ 50, -20,  10,   5,   5,  10, -20,  50]
];

// --- AUDIO ENGINE ---
const audioEngine = {
  ctx: null,
  init() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
  },
  playTone(freq, type, duration, vol = 0.1) {
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(vol, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) { /* Interaction might be required first */ }
  },
  place() { this.init(); this.playTone(400, 'sine', 0.1, 0.2); },
  flip() { this.init(); this.playTone(300, 'triangle', 0.15, 0.1); },
  turn() { this.init(); this.playTone(600, 'sine', 0.1, 0.05); },
  win() {
    this.init();
    this.playTone(400, 'sine', 0.3, 0.2);
    setTimeout(() => this.playTone(500, 'sine', 0.3, 0.2), 150);
    setTimeout(() => this.playTone(600, 'sine', 0.5, 0.2), 300);
  },
  error() { this.init(); this.playTone(150, 'sawtooth', 0.2, 0.1); }
};

// --- AI ENGINE ---
const reversiAI = {
  getBestMove(validMoves, board, player, difficulty) {
    if (difficulty === 'easy') {
      return validMoves[Math.floor(Math.random() * validMoves.length)];
    }
    if (difficulty === 'medium') {
      // Greedy: Maximize flips
      return [...validMoves].sort((a, b) => b.flips.length - a.flips.length)[0];
    }
    if (difficulty === 'hard') {
      return this.getHardMove(validMoves, board, player);
    }
    return validMoves[0];
  },

  getHardMove(validMoves, board, player) {
    let bestScore = -Infinity;
    let bestMove = validMoves[0];

    for (let move of validMoves) {
      const tempBoard = board.map(row => [...row]);
      tempBoard[move.r][move.c] = player;
      for (let f of move.flips) tempBoard[f.r][f.c] = player;

      let score = this.evaluateBoard(tempBoard, player) + move.flips.length;

      if (score > bestScore || (score === bestScore && Math.random() > 0.5)) {
        bestScore = score;
        bestMove = move;
      }
    }
    return bestMove;
  },

  evaluateBoard(board, player) {
    let score = 0;
    const opponent = player === BLACK ? WHITE : BLACK;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (board[r][c] === player) score += AI_WEIGHTS[r][c];
        else if (board[r][c] === opponent) score -= AI_WEIGHTS[r][c];
      }
    }
    return score;
  }
};

// --- GAME HOOK ---
const useReversiGame = () => {
  const [board, setBoard] = useState(Array(8).fill(null).map(() => Array(8).fill(EMPTY)));
  const [turn, setTurn] = useState(BLACK);
  const [history, setHistory] = useState([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [rotations, setRotations] = useState(Array(8).fill(null).map(() => Array(8).fill(0)));

  const getFlips = useCallback((currentBoard, r, c, player) => {
    let flips = [];
    const opponent = player === BLACK ? WHITE : BLACK;

    for (let [dr, dc] of DIRS) {
      let nr = r + dr, nc = c + dc;
      let tempFlips = [];
      while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && currentBoard[nr][nc] === opponent) {
        tempFlips.push({ r: nr, c: nc });
        nr += dr; nc += dc;
      }
      if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && currentBoard[nr][nc] === player) {
        flips.push(...tempFlips);
      }
    }
    return flips;
  }, []);

  const getValidMoves = useCallback((currentBoard, player) => {
    let moves = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (currentBoard[r][c] !== EMPTY) continue;
        let flips = getFlips(currentBoard, r, c, player);
        if (flips.length > 0) moves.push({ r, c, flips });
      }
    }
    return moves;
  }, [getFlips]);

  const initGame = useCallback(() => {
    const newBoard = Array(8).fill(null).map(() => Array(8).fill(EMPTY));
    newBoard[3][3] = WHITE; newBoard[4][4] = WHITE;
    newBoard[3][4] = BLACK; newBoard[4][3] = BLACK;
    
    const newRotations = Array(8).fill(null).map(() => Array(8).fill(0));
    newRotations[3][3] = 180; newRotations[4][4] = 180;
    newRotations[3][4] = 0;   newRotations[4][3] = 0;

    setBoard(newBoard);
    setRotations(newRotations);
    setTurn(BLACK);
    setHistory([]);
    setIsAnimating(false);
  }, []);

  const executeMove = useCallback((r, c, flips, bypassAnim = false) => {
    if (isAnimating && !bypassAnim) return;

    // Save history
    setHistory(prev => [...prev, { 
      board: board.map(row => [...row]), 
      turn, 
      rotations: rotations.map(row => [...row]) 
    }]);

    setIsAnimating(true);
    audioEngine.place();

    // 1. Update board with placement
    const nextBoard = board.map(row => [...row]);
    const nextRots = rotations.map(row => [...row]);
    nextBoard[r][c] = turn;
    nextRots[r][c] = turn === BLACK ? 0 : 180;
    setBoard(nextBoard);
    setRotations(nextRots);

    // 2. Staggered flip animations
    setTimeout(() => {
      flips.forEach((f, i) => {
        setTimeout(() => {
          setBoard(prev => {
            const b = prev.map(row => [...row]);
            b[f.r][f.c] = turn;
            return b;
          });
          setRotations(prev => {
            const rots = prev.map(row => [...row]);
            rots[f.r][f.c] += 180;
            return rots;
          });
          audioEngine.flip();
        }, i * 60);
      });

      // 3. Finalize turn
      setTimeout(() => {
        setTurn(prev => (prev === BLACK ? WHITE : BLACK));
        setIsAnimating(false);
        audioEngine.turn();
      }, flips.length * 60 + 200);
    }, 150);
  }, [board, turn, rotations, isAnimating]);

  const undo = useCallback((isAI) => {
    if (isAnimating || history.length === 0) return;
    
    let targetHistory;
    if (isAI && history.length >= 2) {
      targetHistory = history[history.length - 2];
      setHistory(prev => prev.slice(0, -2));
    } else {
      targetHistory = history[history.length - 1];
      setHistory(prev => prev.slice(0, -1));
    }

    setBoard(targetHistory.board);
    setTurn(targetHistory.turn);
    setRotations(targetHistory.rotations);
    setIsAnimating(false);
  }, [history, isAnimating]);

  return { 
    board, turn, history, isAnimating, rotations, 
    initGame, executeMove, getValidMoves, undo, setTurn 
  };
};

// --- SUB-COMPONENTS ---

const BoardCell = React.memo(({ r, c, value, isValid, rotation, onClick }) => {
  return (
    <div 
      className={`cell relative ${isValid ? 'valid-move' : ''}`}
      onClick={() => isValid && onClick(r, c)}
    >
      <div className="disc-container">
        <div 
          className="disc"
          style={{ 
            opacity: value === EMPTY ? 0 : 1,
            transform: `rotateY(${rotation}deg) scale(${value === EMPTY ? 0.5 : 1})`
          }}
        >
          <div className="face face-black"></div>
          <div className="face face-white"></div>
        </div>
      </div>
    </div>
  );
});

const ToastMessage = ({ message }) => {
  if (!message) return null;
  return (
    <div className="message-toast show">
      {message}
    </div>
  );
};

// --- APP COMPONENT ---

export default function App() {
  const [screen, setScreen] = useState('menu');
  const [mode, setMode] = useState('PVP');
  const [difficulty, setDifficulty] = useState('easy');
  const [playerColor, setPlayerColor] = useState(BLACK);
  const [toast, setToast] = useState('');

  const { 
    board, turn, isAnimating, rotations, 
    initGame, executeMove, getValidMoves, undo, setTurn 
  } = useReversiGame();

  const validMoves = useMemo(() => getValidMoves(board, turn), [board, turn, getValidMoves]);

  // AI Turn Logic
  useEffect(() => {
    if (screen === 'game' && mode === 'PVAI' && turn !== playerColor && !isAnimating) {
      if (validMoves.length > 0) {
        const timer = setTimeout(() => {
          const move = reversiAI.getBestMove(validMoves, board, turn, difficulty);
          executeMove(move.r, move.c, move.flips);
        }, 800);
        return () => clearTimeout(timer);
      }
    }
  }, [turn, screen, mode, playerColor, isAnimating, validMoves, board, difficulty, executeMove]);

  // Game End Logic & Turn Skip
  useEffect(() => {
    if (screen === 'game' && !isAnimating) {
      if (validMoves.length === 0) {
        const opponent = turn === BLACK ? WHITE : BLACK;
        const oppMoves = getValidMoves(board, opponent);
        
        if (oppMoves.length === 0) {
          audioEngine.win();
          setScreen('result');
        } else {
          setToast(`${turn === BLACK ? 'Black' : 'White'} turn skipped!`);
          setTimeout(() => {
            setToast('');
            setTurn(opponent);
          }, 1500);
        }
      }
    }
  }, [validMoves, screen, isAnimating, turn, getValidMoves, setTurn]);

  // Scores
  const scores = useMemo(() => {
    let b = 0, w = 0;
    board.forEach(row => row.forEach(cell => {
      if (cell === BLACK) b++;
      if (cell === WHITE) w++;
    }));
    return { b, w };
  }, [board]);

  const handleStart = (selectedSide) => {
    setPlayerColor(selectedSide || BLACK);
    initGame();
    setScreen('game');
  };

  const handleCellClick = (r, c) => {
    if (isAnimating) return;
    if (mode === 'PVAI' && turn !== playerColor) return;
    const move = validMoves.find(m => m.r === r && m.c === c);
    if (move) executeMove(r, c, move.flips);
    else audioEngine.error();
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white selection:bg-emerald-500 selection:text-white antialiased overflow-hidden font-['Inter']">
      
      {/* Menu Screen */}
      {screen === 'menu' && (
        <div className="screen active bg-gradient-to-br from-slate-900 to-slate-800">
          <div className="text-center mb-12">
            <h1 className="text-7xl font-extrabold tracking-tighter mb-4 text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 drop-shadow-lg">
              REVERSI
            </h1>
            <p className="text-slate-400 font-medium tracking-widest text-sm uppercase">Pro Edition</p>
          </div>
          <button onClick={() => setScreen('mode')} className="btn py-4 w-64 rounded-xl text-lg font-semibold flex items-center justify-center gap-3">
            <Play fill="currentColor" size={20} /> Play Game
          </button>
        </div>
      )}

      {/* Mode Selection */}
      {screen === 'mode' && (
        <div className="screen active bg-gradient-to-br from-slate-900 to-slate-800">
          <h2 className="text-3xl font-bold mb-8">Select Mode</h2>
          <div className="flex flex-col gap-4 w-64">
            <button onClick={() => { setMode('PVP'); handleStart(); }} className="btn py-4 rounded-xl text-lg font-semibold flex items-center justify-center gap-3">
              <User size={20} /> Player vs Player
            </button>
            <button onClick={() => setScreen('difficulty')} className="btn py-4 rounded-xl text-lg font-semibold flex items-center justify-center gap-3">
              <Cpu size={20} /> Player vs AI
            </button>
            <button onClick={() => setScreen('menu')} className="mt-4 text-slate-400 hover:text-white transition flex items-center gap-2">
              <ChevronLeft size={16} /> Back
            </button>
          </div>
        </div>
      )}

      {/* AI Difficulty */}
      {screen === 'difficulty' && (
        <div className="screen active bg-gradient-to-br from-slate-900 to-slate-800">
          <h2 className="text-3xl font-bold mb-8">AI Difficulty</h2>
          <div className="flex flex-col gap-4 w-64">
            <button onClick={() => { setDifficulty('easy'); setScreen('side'); }} className="btn py-4 rounded-xl text-lg font-semibold text-green-400">🟢 Easy</button>
            <button onClick={() => { setDifficulty('medium'); setScreen('side'); }} className="btn py-4 rounded-xl text-lg font-semibold text-yellow-400">🟡 Medium</button>
            <button onClick={() => { setDifficulty('hard'); setScreen('side'); }} className="btn py-4 rounded-xl text-lg font-semibold text-red-400">🔴 Hard</button>
            <button onClick={() => setScreen('mode')} className="mt-4 text-slate-400 hover:text-white transition flex items-center gap-2">
              <ChevronLeft size={16} /> Back
            </button>
          </div>
        </div>
      )}

      {/* Side Selection */}
      {screen === 'side' && (
        <div className="screen active bg-gradient-to-br from-slate-900 to-slate-800">
          <h2 className="text-3xl font-bold mb-8">Choose Your Side</h2>
          <p className="text-slate-400 mb-6 text-sm">Black always moves first.</p>
          <div className="flex gap-6">
            <button onClick={() => handleStart(BLACK)} className="btn p-6 rounded-2xl flex flex-col items-center gap-4 transition-transform hover:scale-105 active:scale-95">
              <div className="w-16 h-16 rounded-full bg-[#111] shadow-lg border-2 border-slate-700"></div>
              <span className="font-bold">Play Black</span>
            </button>
            <button onClick={() => handleStart(WHITE)} className="btn p-6 rounded-2xl flex flex-col items-center gap-4 transition-transform hover:scale-105 active:scale-95">
              <div className="w-16 h-16 rounded-full bg-[#eee] shadow-lg border-2 border-slate-300"></div>
              <span className="font-bold text-slate-400">Play White</span>
            </button>
          </div>
          <button onClick={() => setScreen('difficulty')} className="mt-8 text-slate-400 hover:text-white transition flex items-center gap-2">
            <ChevronLeft size={16} /> Back
          </button>
        </div>
      )}

      {/* Game Screen */}
      {(screen === 'game' || screen === 'result') && (
        <div className="screen active bg-slate-900 p-4">
          <ToastMessage message={toast} />

          {/* Top Bar */}
          <div className="w-full max-w-[450px] flex justify-between items-center mb-6 px-4">
            <button 
              onClick={() => undo(mode === 'PVAI')} 
              disabled={isAnimating}
              className="btn px-4 py-2 rounded-lg text-sm font-semibold text-slate-300 flex items-center gap-2 disabled:opacity-30"
            >
              <RotateCcw size={16} /> Undo
            </button>
            <button onClick={() => setScreen('menu')} className="btn px-4 py-2 rounded-lg text-sm font-semibold text-rose-400 flex items-center gap-2">
              <LogOut size={16} /> Exit
            </button>
          </div>

          {/* Score Board */}
          <div className="flex gap-4 mb-8 w-full max-w-[450px] px-4">
            <div className={`score-pill flex-1 flex items-center justify-between p-3 ${turn === BLACK ? 'active-turn' : ''}`}>
              <div className="flex items-center gap-2">
                <div className="minidisc black"></div>
                <span className="font-bold text-slate-300 text-xs uppercase tracking-wider">
                  {mode === 'PVAI' ? (playerColor === BLACK ? 'You' : 'AI') : 'Player 1'}
                </span>
              </div>
              <span className="text-2xl font-black">{scores.b}</span>
            </div>
            <div className={`score-pill flex-1 flex items-center justify-between p-3 ${turn === WHITE ? 'active-turn' : ''}`}>
              <span className="text-2xl font-black">{scores.w}</span>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-300 text-xs uppercase tracking-wider text-right">
                  {mode === 'PVAI' ? (playerColor === WHITE ? 'You' : 'AI') : 'Player 2'}
                </span>
                <div className="minidisc white"></div>
              </div>
            </div>
          </div>

          {/* Main Board */}
          <div className="board-container select-none">
            <div className="board">
              {board.map((row, r) => row.map((cell, c) => (
                <BoardCell 
                  key={`${r}-${c}`}
                  r={r} c={c}
                  value={cell}
                  rotation={rotations[r][c]}
                  isValid={!isAnimating && validMoves.some(m => m.r === r && m.c === c) && (mode === 'PVP' || turn === playerColor)}
                  onClick={handleCellClick}
                />
              )))}
            </div>
          </div>

          {/* Result Overlay */}
          {screen === 'result' && (
            <div className="screen active bg-slate-900/90 backdrop-blur-sm z-50 animate-in fade-in duration-500">
              <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 text-center max-w-sm w-[90%] shadow-2xl scale-in">
                <div className="text-6xl mb-4">
                  {scores.b === scores.w ? <Handshake size={64} className="mx-auto text-slate-400" /> : <Trophy size={64} className="mx-auto text-yellow-400" />}
                </div>
                <h2 className="text-4xl font-extrabold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                  {scores.b === scores.w ? "Draw Game!" : (scores.b > scores.w ? "Black Wins!" : "White Wins!")}
                </h2>
                <p className="text-slate-400 mb-8 text-lg font-medium">
                  Black: {scores.b}  |  White: {scores.w}
                </p>
                
                <div className="flex flex-col gap-3">
                  <button onClick={() => { initGame(); setScreen('game'); }} className="btn py-4 rounded-xl font-bold bg-white/10 hover:bg-white/20">🔄 Play Again</button>
                  <button onClick={() => setScreen('menu')} className="btn py-4 rounded-xl font-bold text-slate-400 hover:text-white">🏠 Main Menu</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CUSTOM CSS STYLES */}
      <style>{`
        :root {
            --board-bg: #0b7a3f;
            --grid-line: rgba(0, 0, 0, 0.4);
            --board-border: #1a1a1a;
            --highlight: rgba(255, 255, 255, 0.3);
            --black-disc: #111;
            --white-disc: #eee;
        }

        .btn {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            cursor: pointer;
        }
        .btn:hover:not(:disabled) {
            background: rgba(255, 255, 255, 0.15);
            transform: translateY(-2px);
            border-color: rgba(255, 255, 255, 0.3);
        }
        .btn:active:not(:disabled) {
            transform: translateY(0) scale(0.98);
        }

        .screen {
            display: none;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            width: 100%;
            position: absolute;
            top: 0; left: 0;
            z-index: 10;
        }
        .screen.active {
            display: flex;
        }

        .board-container {
            background: var(--board-border);
            padding: min(4vw, 15px);
            border-radius: 12px;
            box-shadow: 0 20px 50px rgba(0,0,0,0.5), inset 0 2px 5px rgba(255,255,255,0.1);
            position: relative;
        }

        .board {
            display: grid;
            grid-template-columns: repeat(8, 1fr);
            grid-template-rows: repeat(8, 1fr);
            background-color: var(--grid-line);
            gap: 2px;
            border: 2px solid var(--grid-line);
            width: min(90vw, 450px);
            height: min(90vw, 450px);
            border-radius: 4px;
            overflow: hidden;
        }

        .cell {
            background-color: var(--board-bg);
            position: relative;
            cursor: pointer;
            display: flex;
            justify-content: center;
            align-items: center;
            transition: background-color 0.2s;
        }

        .valid-move::before {
            content: '';
            position: absolute;
            width: 25%;
            height: 25%;
            background-color: var(--highlight);
            border-radius: 50%;
            pointer-events: none;
            box-shadow: 0 0 10px rgba(255,255,255,0.4);
            animation: pulse 2s infinite;
        }
        
        .cell:hover.valid-move {
            background-color: #0c8c48;
        }

        @keyframes pulse {
            0% { transform: scale(1); opacity: 0.5; }
            50% { transform: scale(1.4); opacity: 0.9; }
            100% { transform: scale(1); opacity: 0.5; }
        }

        .disc-container {
            width: 85%;
            height: 85%;
            position: absolute;
            perspective: 600px;
            pointer-events: none;
        }

        .disc {
            width: 100%;
            height: 100%;
            position: absolute;
            transform-style: preserve-3d;
            transition: transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s;
        }

        .face {
            position: absolute;
            width: 100%;
            height: 100%;
            border-radius: 50%;
            backface-visibility: hidden;
            box-shadow: inset 0 -3px 6px rgba(0,0,0,0.4), 0 4px 6px rgba(0,0,0,0.4);
        }

        .face-black {
            background: radial-gradient(circle at 30% 30%, #444, var(--black-disc) 60%);
            transform: rotateY(0deg) translateZ(1px);
        }

        .face-white {
            background: radial-gradient(circle at 30% 30%, #fff, #ccc 80%);
            transform: rotateY(180deg) translateZ(1px);
        }

        .score-pill {
            background: rgba(15, 23, 42, 0.8);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 1rem;
            transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            opacity: 0.5;
            transform: scale(0.95);
        }
        .score-pill.active-turn {
            opacity: 1;
            transform: scale(1.05);
            box-shadow: 0 0 25px rgba(52, 211, 153, 0.15);
            border-color: rgba(52, 211, 153, 0.4);
            background: rgba(15, 23, 42, 1);
        }

        .minidisc {
            width: 20px; height: 20px;
            border-radius: 50%;
            box-shadow: inset 0 -2px 4px rgba(0,0,0,0.5);
        }
        .minidisc.black { background: var(--black-disc); }
        .minidisc.white { background: var(--white-disc); }
        
        .message-toast {
            position: absolute;
            top: 20%;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.85);
            color: white;
            padding: 12px 24px;
            border-radius: 50px;
            font-weight: 700;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.3s, transform 0.3s;
            z-index: 100;
            backdrop-filter: blur(5px);
            border: 1px solid rgba(255,255,255,0.1);
        }
        .message-toast.show {
            opacity: 1;
            transform: translate(-50%, -10px);
        }

        .scale-in {
            animation: scale-in 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
        @keyframes scale-in {
            from { transform: scale(0.85); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}