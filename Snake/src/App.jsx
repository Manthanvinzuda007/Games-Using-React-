import React, { useState, useEffect, useRef, useCallback } from 'react';

// --- STYLES ---
const gameStyles = `
  @keyframes shake {
    0% { transform: translate(1px, 1px) rotate(0deg); }
    10% { transform: translate(-1px, -2px) rotate(-1deg); }
    20% { transform: translate(-3px, 0px) rotate(1deg); }
    30% { transform: translate(3px, 2px) rotate(0deg); }
    40% { transform: translate(1px, -1px) rotate(1deg); }
    50% { transform: translate(-1px, 2px) rotate(-1deg); }
    100% { transform: translate(0, 0) rotate(0deg); }
  }
  .shake-anim { animation: shake 0.5s; }
  .game-wrapper {
    background-color: #020617;
    color: #f8fafc;
    font-family: 'Inter', sans-serif;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    min-height: 100vh; width: 100vw; overflow: hidden; touch-action: none;
  }
  #game-container {
    position: relative; border: 4px solid #334155; border-radius: 12px;
    box-shadow: 0 0 40px rgba(34, 197, 94, 0.15); background: #000;
  }
  .control-btn {
    background: #1e293b; border: 1px solid #334155; border-radius: 12px;
    width: 60px; height: 60px; display: flex; align-items: center; justify-content: center;
    font-size: 24px; cursor: pointer; color: white; transition: all 0.1s;
  }
  .control-btn:active { transform: scale(0.9); background: #334155; }
  .difficulty-btn {
    padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: bold;
    transition: all 0.2s; border: 1px solid #334155;
  }
`;

// --- AUDIO HELPER ---
const playSound = (freq, type, duration) => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + duration);
  } catch (e) { /* Audio focus issues on some browsers */ }
};

const TILE_COUNT = 20;

const App = () => {
  const [gameState, setGameState] = useState('READY'); 
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => localStorage.getItem('snake-pro-high') || 0);
  const [canvasSize, setCanvasSize] = useState(400);
  const [difficulty, setDifficulty] = useState('MEDIUM');
  const [isShake, setIsShake] = useState(false);
  
  const canvasRef = useRef(null);
  const snakeRef = useRef([]);
  const foodRef = useRef({ x: 5, y: 5, type: 'NORMAL' });
  const particlesRef = useRef([]);
  const directionRef = useRef({ dx: 0, dy: -1 });
  const nextDirRef = useRef({ dx: 0, dy: -1 });
  const gameLoopRef = useRef(null);
  const currentSpeed = useRef(100);

  const speedMap = { EASY: 140, MEDIUM: 100, HARD: 60 };

  useEffect(() => {
    const handleResize = () => {
      const size = Math.min(window.innerWidth - 40, 400);
      setCanvasSize(size);
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const createParticles = (x, y, color) => {
    for (let i = 0; i < 10; i++) {
      particlesRef.current.push({
        x, y,
        vx: (Math.random() - 0.5) * 5,
        vy: (Math.random() - 0.5) * 5,
        alpha: 1,
        color
      });
    }
  };

  const createFood = useCallback(() => {
    const isGolden = Math.random() > 0.92;
    const newFood = {
      x: Math.floor(Math.random() * TILE_COUNT),
      y: Math.floor(Math.random() * TILE_COUNT),
      type: isGolden ? 'GOLDEN' : 'NORMAL'
    };
    const isOnSnake = snakeRef.current.some(p => p.x === newFood.x && p.y === newFood.y);
    if (isOnSnake) return createFood();
    foodRef.current = newFood;
  }, []);

  const gameOver = useCallback(() => {
    setGameState('GAME_OVER');
    setIsShake(true);
    setTimeout(() => setIsShake(false), 500);
    playSound(120, 'sawtooth', 0.5);
    if (gameLoopRef.current) clearInterval(gameLoopRef.current);
  }, []);

  const update = useCallback(() => {
    if (gameState !== 'PLAYING') return;

    directionRef.current = nextDirRef.current;
    const { dx, dy } = directionRef.current;
    const snake = [...snakeRef.current];
    const head = { x: snake[0].x + dx, y: snake[0].y + dy };

    if (head.x < 0 || head.x >= TILE_COUNT || head.y < 0 || head.y >= TILE_COUNT || 
        snake.some(p => p.x === head.x && p.y === head.y)) {
      gameOver();
      return;
    }

    snake.unshift(head);

    if (head.x === foodRef.current.x && head.y === foodRef.current.y) {
      const isGolden = foodRef.current.type === 'GOLDEN';
      const points = isGolden ? 50 : 10;
      setScore(s => {
        const ns = s + points;
        if (ns > highScore) {
          setHighScore(ns);
          localStorage.setItem('snake-pro-high', ns);
        }
        return ns;
      });
      
      playSound(isGolden ? 900 : 440, 'sine', 0.1);
      createParticles(head.x, head.y, isGolden ? '#fbbf24' : '#ef4444');
      createFood();
    } else {
      snake.pop();
    }
    
    particlesRef.current = particlesRef.current
      .map(p => ({ ...p, x: p.x + p.vx * 0.1, y: p.y + p.vy * 0.1, alpha: p.alpha - 0.04 }))
      .filter(p => p.alpha > 0);

    snakeRef.current = snake;
  }, [gameState, highScore, createFood, gameOver]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const sz = canvas.width / TILE_COUNT;

    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Particles
    particlesRef.current.forEach(p => {
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x * sz, p.y * sz, 3, 3);
    });
    ctx.globalAlpha = 1;

    // Food
    const f = foodRef.current;
    ctx.fillStyle = f.type === 'GOLDEN' ? '#fbbf24' : '#ef4444';
    ctx.shadowBlur = 15;
    ctx.shadowColor = ctx.fillStyle;
    ctx.beginPath();
    ctx.arc(f.x * sz + sz/2, f.y * sz + sz/2, sz/2.8, 0, Math.PI*2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // --- RAINBOW SNAKE LOGIC ---
    snakeRef.current.forEach((p, i) => {
      const isHead = i === 0;
      
      if (isHead) {
        ctx.fillStyle = '#4ade80'; // Head remains vibrant green
      } else {
        // Rainbow effect: Hue changes based on segment index
        const hue = (i * 15) % 360; 
        ctx.fillStyle = `hsl(${hue}, 80%, 50%)`;
      }

      const x = p.x * sz + 1, y = p.y * sz + 1, w = sz - 2, h = sz - 2;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, w, h, isHead ? 6 : 4);
      else ctx.rect(x, y, w, h);
      ctx.fill();

      // Eye logic
      if (isHead) {
        ctx.fillStyle = '#000';
        const eye = sz / 6;
        const {dx, dy} = directionRef.current;
        if (dx === 1) { ctx.fillRect(x+w-5, y+3, eye, eye); ctx.fillRect(x+w-5, y+h-6, eye, eye); }
        else if (dx === -1) { ctx.fillRect(x+3, y+3, eye, eye); ctx.fillRect(x+3, y+h-6, eye, eye); }
        else if (dy === -1) { ctx.fillRect(x+3, y+3, eye, eye); ctx.fillRect(x+w-6, y+3, eye, eye); }
        else { ctx.fillRect(x+3, y+h-6, eye, eye); ctx.fillRect(x+w-6, y+h-6, eye, eye); }
      }
    });
  }, []);

  useEffect(() => {
    const loop = () => { update(); draw(); };
    if (gameState === 'PLAYING') {
      gameLoopRef.current = setInterval(loop, currentSpeed.current);
    } else {
      draw();
    }
    return () => clearInterval(gameLoopRef.current);
  }, [gameState, update, draw]);

  const handleInput = useCallback((key) => {
    const { dx, dy } = directionRef.current;
    const k = key.toLowerCase(); 
    if ((k === 'arrowup' || k === 'w') && dy !== 1) nextDirRef.current = { dx: 0, dy: -1 };
    else if ((k === 'arrowdown' || k === 's') && dy !== -1) nextDirRef.current = { dx: 0, dy: 1 };
    else if ((k === 'arrowleft' || k === 'a') && dx !== 1) nextDirRef.current = { dx: -1, dy: 0 };
    else if ((k === 'arrowright' || k === 'd') && dx !== -1) nextDirRef.current = { dx: 1, dy: 0 };
  }, []);

  useEffect(() => {
    const onKey = (e) => handleInput(e.key);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleInput]);

  const startGame = () => {
    snakeRef.current = [{ x: 10, y: 10 }, { x: 10, y: 11 }, { x: 10, y: 12 }];
    directionRef.current = { dx: 0, dy: -1 };
    nextDirRef.current = { dx: 0, dy: -1 };
    currentSpeed.current = speedMap[difficulty];
    setScore(0);
    particlesRef.current = [];
    createFood();
    setGameState('PLAYING');
    playSound(600, 'sine', 0.1);
  };

  return (
    <div className="game-wrapper">
      <style>{gameStyles}</style>

      <div className="mb-6 flex flex-col items-center">
        <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-blue-500 to-purple-600 tracking-tighter mb-2">
          RAINBOW SNAKE
        </h1>
        <div className="flex gap-4 text-sm font-medium bg-slate-900 px-6 py-2 rounded-full border border-slate-800 shadow-lg">
          <span className="text-slate-400 uppercase tracking-widest text-[10px]">Score <span className="text-white text-sm ml-1">{score}</span></span>
          <div className="w-[1px] bg-slate-700"></div>
          <span className="text-slate-400 uppercase tracking-widest text-[10px]">Best <span className="text-white text-sm ml-1">{highScore}</span></span>
        </div>
      </div>

      {gameState === 'READY' && (
        <div className="flex gap-2 mb-6">
          {['EASY', 'MEDIUM', 'HARD'].map(lvl => (
            <button 
              key={lvl} 
              onClick={() => setDifficulty(lvl)}
              className={`difficulty-btn px-4 py-2 rounded-xl transition-all ${difficulty === lvl ? 'bg-white text-black' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
            >
              {lvl}
            </button>
          ))}
        </div>
      )}

      <div id="game-container" className={isShake ? 'shake-anim' : ''}>
        <canvas ref={canvasRef} width={canvasSize} height={canvasSize} />
        
        {gameState !== 'PLAYING' && (
          <div id="overlay" className="bg-black/80 backdrop-blur-md absolute inset-0 flex flex-col items-center justify-center rounded-lg p-6">
            <h2 className={`text-5xl font-black mb-6 text-center tracking-tight ${gameState === 'GAME_OVER' ? 'text-red-500' : 'text-white'}`}>
              {gameState === 'GAME_OVER' ? 'CRASHED!' : 'RAINBOW PRO'}
            </h2>
            <button 
              onClick={startGame} 
              className="bg-white text-black hover:scale-105 active:scale-95 px-12 py-4 rounded-2xl font-black text-2xl transition-all shadow-2xl"
            >
              {gameState === 'GAME_OVER' ? 'RETRY' : 'START'}
            </button>
          </div>
        )}
      </div>

      <div className="mt-8 grid grid-cols-3 gap-3 md:hidden">
        <div></div>
        <button className="control-btn" onTouchStart={() => handleInput('w')}>▲</button>
        <div></div>
        <button className="control-btn" onTouchStart={() => handleInput('a')}>◀</button>
        <button className="control-btn" onTouchStart={() => handleInput('s')}>▼</button>
        <button className="control-btn" onTouchStart={() => handleInput('d')}>▶</button>
      </div>
    </div>
  );
};

export default App;