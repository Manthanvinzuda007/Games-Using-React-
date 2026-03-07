import React, { useState, useEffect, useRef, useCallback } from 'react';

// --- STYLES & CONFIG ---
// We inject the custom CSS from your original file directly here.
const customCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;500;700&display=swap');

  body {
      font-family: 'Outfit', sans-serif;
      background: linear-gradient(-45deg, #0f172a, #1e1b4b, #312e81, #0f172a);
      background-size: 400% 400%;
      animation: gradientBG 15s ease infinite;
      height: 100vh;
      overflow: hidden;
      user-select: none;
      -webkit-tap-highlight-color: transparent;
      margin: 0;
  }

  @keyframes gradientBG {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
  }

  .glass-panel {
      background: rgba(30, 41, 59, 0.7);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .cell {
      transition: all 0.2s ease;
      box-shadow: inset 2px 2px 5px rgba(0,0,0,0.2), inset -2px -2px 5px rgba(255,255,255,0.05);
  }
  
  .cell:active {
      transform: scale(0.95);
  }

  .cell-hover:hover {
      background: rgba(255, 255, 255, 0.05);
      cursor: pointer;
  }

  .winning-cell {
      background: rgba(255, 255, 255, 0.15) !important;
      animation: winPulse 1s infinite alternate;
  }

  @keyframes winPulse {
      from { box-shadow: 0 0 10px rgba(255,255,255,0.1); }
      to { box-shadow: 0 0 25px rgba(255,255,255,0.3); }
  }

  .x-path {
      stroke-dasharray: 100;
      stroke-dashoffset: 100;
      animation: draw 0.4s ease forwards;
  }
  
  .o-circle {
      stroke-dasharray: 300;
      stroke-dashoffset: 300;
      animation: draw 0.4s ease forwards;
  }

  @keyframes draw {
      to { stroke-dashoffset: 0; }
  }

  #confetti-canvas {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 50;
  }

  /* Tailwind Custom Classes Mapped */
  .text-neonBlue { color: #00f3ff; }
  .text-neonPink { color: #ff00ff; }
  .border-neonBlue { border-color: #00f3ff; }
  .border-neonPink { border-color: #ff00ff; }
  .from-neonBlue { --tw-gradient-from: #00f3ff; --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to, rgba(0, 243, 255, 0)); }
  .to-neonPink { --tw-gradient-to: #ff00ff; }
  .focus\\:border-neonBlue\\/50:focus { border-color: rgba(0, 243, 255, 0.5); }
  .focus\\:border-neonPink\\/50:focus { border-color: rgba(255, 0, 255, 0.5); }
`;

const winningConditions = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // Cols
  [0, 4, 8], [2, 4, 6]             // Diagonals
];

export default function App() {
  // --- STATE ---
  const [board, setBoard] = useState(Array(9).fill(null));
  const [currentPlayer, setCurrentPlayer] = useState('X');
  const [gameActive, setGameActive] = useState(true);
  const [scores, setScores] = useState({ X: 0, O: 0, draw: 0 });
  const [names, setNames] = useState({ X: "Player X", O: "Player O" });
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isDark, setIsDark] = useState(true);
  const [winData, setWinData] = useState({ isOver: false, winner: null, indices: [] });

  // Refs for Audio & Canvas
  const audioCtxRef = useRef(null);
  const canvasRef = useRef(null);

  // --- DARK MODE TOGGLE ---
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  // --- AUDIO SYNTH ---
  const playTone = useCallback((type) => {
    if (!soundEnabled) return;
    
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    const audioCtx = audioCtxRef.current;
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;

    if (type === 'click-x') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.1);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === 'click-o') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.1);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === 'win') {
      const notes = [440, 554, 659, 880];
      notes.forEach((freq, i) => {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.connect(g);
        g.connect(audioCtx.destination);
        o.type = 'triangle';
        o.frequency.value = freq;
        g.gain.setValueAtTime(0, now + i * 0.05);
        g.gain.linearRampToValueAtTime(0.1, now + i * 0.05 + 0.05);
        g.gain.linearRampToValueAtTime(0, now + i * 0.05 + 0.3);
        o.start(now + i * 0.05);
        o.stop(now + i * 0.05 + 0.4);
      });
    } else if (type === 'reset') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(200, now);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    }
  }, [soundEnabled]);

  // --- CONFETTI LOGIC ---
  const fireConfetti = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    const colors = ['#00f3ff', '#ff00ff', '#ffffff'];

    for (let i = 0; i < 100; i++) {
      particles.push({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
        w: Math.random() * 8 + 2,
        h: Math.random() * 5 + 2,
        vx: (Math.random() - 0.5) * 20,
        vy: (Math.random() - 0.5) * 20,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 100,
        gravity: 0.2
      });
    }

    let animationFrameId;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let active = false;

      particles.forEach(p => {
        if (p.life > 0) {
          active = true;
          p.x += p.vx;
          p.y += p.vy;
          p.vy += p.gravity;
          p.life--;
          p.vx *= 0.95;

          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.life / 100;
          ctx.fillRect(p.x, p.y, p.w, p.h);
        }
      });

      if (active) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
    animate();

    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  // --- GAME LOGIC ---
  const handleCellClick = (index) => {
    if (!gameActive || board[index]) return;

    const newBoard = [...board];
    newBoard[index] = currentPlayer;
    setBoard(newBoard);
    
    playTone(currentPlayer === 'X' ? 'click-x' : 'click-o');
    checkResult(newBoard, currentPlayer);
  };

  const checkResult = (currentBoard, player) => {
    let roundWon = false;
    let winInd = [];

    for (let i = 0; i < winningConditions.length; i++) {
      const [a, b, c] = winningConditions[i];
      if (currentBoard[a] && currentBoard[a] === currentBoard[b] && currentBoard[a] === currentBoard[c]) {
        roundWon = true;
        winInd = [a, b, c];
        break;
      }
    }

    if (roundWon) {
      setGameActive(false);
      setScores(prev => ({ ...prev, [player]: prev[player] + 1 }));
      setWinData({ isOver: true, winner: player, indices: winInd });
      playTone('win');
      fireConfetti();
      return;
    }

    if (!currentBoard.includes(null)) {
      setGameActive(false);
      setScores(prev => ({ ...prev, draw: prev.draw + 1 }));
      setWinData({ isOver: true, winner: null, indices: [] });
      playTone('reset');
      return;
    }

    setCurrentPlayer(player === 'X' ? 'O' : 'X');
  };

  const resetGame = () => {
    setBoard(Array(9).fill(null));
    setGameActive(true);
    setCurrentPlayer('X');
    setWinData({ isOver: false, winner: null, indices: [] });
    playTone('reset');
    
    // Clear canvas
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  // --- RENDER HELPERS ---
  const renderCellContent = (value) => {
    if (value === 'X') {
      return (
        <svg className="w-3/5 h-3/5 drop-shadow-lg" viewBox="0 0 100 100">
          <path d="M20,20 L80,80 M80,20 L20,80" stroke="#00f3ff" strokeWidth="12" strokeLinecap="round" className="x-path" />
        </svg>
      );
    }
    if (value === 'O') {
      return (
        <svg className="w-3/5 h-3/5 drop-shadow-lg" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="35" stroke="#ff00ff" strokeWidth="12" fill="none" className="o-circle" />
        </svg>
      );
    }
    return null;
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: customCSS }} />
      <canvas ref={canvasRef} id="confetti-canvas"></canvas>

      <div className="text-white flex items-center justify-center p-4 min-h-screen">
        <main className="w-full max-w-md flex flex-col gap-6 relative z-10">
          
          {/* Header */}
          <header className="flex justify-between items-center glass-panel p-4 rounded-2xl shadow-xl">
            <h1 className="text-2xl font-bold tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-neonBlue to-neonPink">
              NEON XO
            </h1>
            <div className="flex gap-3">
              <button onClick={() => setIsDark(!isDark)} className="p-2 rounded-full hover:bg-white/10 transition text-gray-300" aria-label="Toggle Theme">
                {isDark ? (
                  <svg className="w-5 h-5 block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                ) : (
                  <svg className="w-5 h-5 block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>
                )}
              </button>
              <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-2 rounded-full hover:bg-white/10 transition text-gray-300" aria-label="Toggle Sound">
                {soundEnabled ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"></path></svg>
                ) : (
                  <svg className="w-5 h-5 block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zM17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"></path></svg>
                )}
              </button>
            </div>
          </header>

          {/* Scoreboard */}
          <div className="grid grid-cols-3 gap-3">
            <div className="glass-panel p-3 rounded-xl flex flex-col items-center justify-center border-b-2 border-neonBlue">
              <input 
                type="text" 
                value={names.X} 
                onChange={(e) => setNames({...names, X: e.target.value})}
                className="bg-transparent text-center text-xs text-neonBlue font-bold uppercase tracking-wider w-full outline-none focus:border-b focus:border-neonBlue/50 mb-1" 
              />
              <span className="text-2xl font-bold">{scores.X}</span>
            </div>
            <div className="glass-panel p-3 rounded-xl flex flex-col items-center justify-center border-b-2 border-gray-500">
              <span className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Draws</span>
              <span className="text-2xl font-bold">{scores.draw}</span>
            </div>
            <div className="glass-panel p-3 rounded-xl flex flex-col items-center justify-center border-b-2 border-neonPink">
              <input 
                type="text" 
                value={names.O} 
                onChange={(e) => setNames({...names, O: e.target.value})}
                className="bg-transparent text-center text-xs text-neonPink font-bold uppercase tracking-wider w-full outline-none focus:border-b focus:border-neonPink/50 mb-1" 
              />
              <span className="text-2xl font-bold">{scores.O}</span>
            </div>
          </div>

          {/* Turn Indicator */}
          <div 
            className="glass-panel py-3 px-6 rounded-full mx-auto flex items-center gap-3 shadow-lg transition-all duration-300"
            style={{ 
              borderColor: currentPlayer === 'X' ? 'rgba(0, 243, 255, 0.3)' : 'rgba(255, 0, 255, 0.3)',
              borderWidth: '1px'
            }}
          >
            <span className={`text-xl font-bold ${currentPlayer === 'X' ? 'text-neonBlue' : 'text-neonPink'}`}>
              {currentPlayer}
            </span>
            <span className="text-sm uppercase tracking-widest font-medium">
              It's {currentPlayer === 'X' ? names.X : names.O}'s Turn
            </span>
          </div>

          {/* Game Grid */}
          <div className="glass-panel p-4 rounded-3xl shadow-2xl relative">
            <div className="grid grid-cols-3 gap-3 aspect-square">
              {board.map((cellValue, index) => {
                const isWinningCell = winData.indices.includes(index);
                return (
                  <div 
                    key={index}
                    onClick={() => handleCellClick(index)}
                    className={`cell bg-slate-800/50 rounded-xl flex items-center justify-center text-4xl overflow-hidden ${!cellValue && gameActive ? 'cell-hover' : ''} ${isWinningCell ? 'winning-cell' : ''}`}
                  >
                    {renderCellContent(cellValue)}
                  </div>
                );
              })}
            </div>
            
            {/* Result Overlay */}
            <div 
              className={`absolute inset-0 bg-black/80 backdrop-blur-sm rounded-3xl flex flex-col items-center justify-center transition-all duration-300 z-20 ${winData.isOver ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
            >
              <h2 
                className={`text-4xl font-bold mb-2 transition-transform duration-500 ${winData.isOver ? 'scale-100' : 'scale-0'} ${winData.winner === 'X' ? 'text-neonBlue drop-shadow-[0_0_10px_rgba(0,243,255,0.5)]' : winData.winner === 'O' ? 'text-neonPink drop-shadow-[0_0_10px_rgba(255,0,255,0.5)]' : 'text-white'}`}
              >
                {winData.winner ? `${winData.winner} Wins!` : "It's a Draw"}
              </h2>
              <p className="text-gray-300 mb-6 text-sm uppercase tracking-widest">
                {winData.winner ? `${winData.winner === 'X' ? names.X : names.O} takes the round` : "No more moves left"}
              </p>
              <button 
                onClick={resetGame} 
                className="bg-gradient-to-r from-neonBlue to-neonPink px-8 py-3 rounded-full font-bold shadow-lg hover:shadow-[0_0_15px_rgba(0,243,255,0.5)] transform hover:scale-105 transition active:scale-95 text-white"
              >
                Play Again
              </button>
            </div>
          </div>

          {/* Footer Control */}
          <div className="text-center">
            <button 
              onClick={resetGame} 
              className="text-xs text-gray-500 hover:text-white uppercase tracking-widest transition flex items-center justify-center gap-2 mx-auto"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
              </svg>
              Reset Board
            </button>
          </div>

        </main>
      </div>
    </>
  );
}