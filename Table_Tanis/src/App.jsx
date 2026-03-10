// By Manthan Vinzuda
import React, { useEffect, useRef, useState } from 'react';

// --- Constants ---
const WIDTH = 900;
const HEIGHT = 500;
const PADDLE_WIDTH = 12;
const PADDLE_HEIGHT = 100;
const BALL_RADIUS = 7;
const WINNING_SCORE = 11;

// --- Audio System ---
let audioCtx = null;

const initAudio = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
};

const playSound = (freq, type = 'square', duration = 0.1) => {
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  
  gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
  
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
};

// --- Particle Class ---
class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.size = Math.random() * 4 + 1;
    this.speedX = (Math.random() - 0.5) * 8;
    this.speedY = (Math.random() - 0.5) * 8;
    this.alpha = 1;
  }
  update() {
    this.x += this.speedX;
    this.y += this.speedY;
    this.alpha -= 0.02;
  }
  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.alpha);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export default function App() {
  // --- Refs for DOM Elements & Game Loop ---
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const requestRef = useRef(null);

  // --- UI State ---
  const [uiState, setUiState] = useState({
    playerScore: 0,
    cpuScore: 0,
    level: 1,
    speedWidth: 0,
  });

  const [overlay, setOverlay] = useState({
    visible: true,
    title: 'Neon Pro',
    msg: 'The Ultimate Table Tennis Challenge',
    btnText: 'INITIALIZE GAME'
  });

  // --- Mutable Game State (Avoids Re-renders) ---
  const gameState = useRef({
    running: false,
    playerScore: 0,
    cpuScore: 0,
    level: 1,
    ball: { x: WIDTH / 2, y: HEIGHT / 2, dx: 6, dy: 6, speed: 7 },
    player: { x: 20, y: HEIGHT / 2 - 50, color: '#22d3ee' },
    cpu: { x: WIDTH - 32, y: HEIGHT / 2 - 50, speed: 4.5, color: '#ec4899' },
    particles: [],
    ballTrail: []
  });

  // --- Game Mechanics ---
  const createExplosion = (x, y, color) => {
    for (let i = 0; i < 15; i++) {
      gameState.current.particles.push(new Particle(x, y, color));
    }
    // Trigger CSS shake
    if (containerRef.current) {
      containerRef.current.classList.add('shake');
      setTimeout(() => {
        if (containerRef.current) containerRef.current.classList.remove('shake');
      }, 150);
    }
  };

  const resetBall = (winner) => {
    const state = gameState.current;
    state.ball.x = WIDTH / 2;
    state.ball.y = HEIGHT / 2;
    state.ball.speed = 7 + (state.level * 0.4);
    state.ball.dx = (winner === 'player' ? -1 : 1) * state.ball.speed;
    state.ball.dy = (Math.random() - 0.5) * 10;
    state.ballTrail = [];
  };

  const checkCollision = (b, p) => {
    return b.x + BALL_RADIUS > p.x && 
           b.x - BALL_RADIUS < p.x + PADDLE_WIDTH && 
           b.y + BALL_RADIUS > p.y && 
           b.y - BALL_RADIUS < p.y + PADDLE_HEIGHT;
  };

  const handleGameOver = () => {
    const state = gameState.current;
    if (state.playerScore >= WINNING_SCORE || state.cpuScore >= WINNING_SCORE) {
      state.running = false;
      
      setOverlay({
        visible: true,
        title: state.playerScore >= WINNING_SCORE ? "VICTORY" : "DEFEATED",
        msg: `FINAL SCORE ${state.playerScore} - ${state.cpuScore}`,
        btnText: "RE-INITIALIZE"
      });

      // Reset internal scores
      state.playerScore = 0;
      state.cpuScore = 0;
      state.level = 1;
      
      // Sync UI
      setUiState({
        playerScore: 0,
        cpuScore: 0,
        level: 1,
        speedWidth: 0
      });
    }
  };

  // --- Main Loop ---
  const updateAndRender = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const state = gameState.current;

    // -- UPDATE LOGIC --
    if (state.running) {
      // Trail
      state.ballTrail.push({ x: state.ball.x, y: state.ball.y });
      if (state.ballTrail.length > 8) state.ballTrail.shift();

      // Ball Movement
      state.ball.x += state.ball.dx;
      state.ball.y += state.ball.dy;

      // CPU AI
      let targetY = state.ball.y - PADDLE_HEIGHT / 2;
      state.cpu.y += (targetY - state.cpu.y) * 0.12 * (0.8 + state.level * 0.1);

      // Wall Collision (Top/Bottom)
      if (state.ball.y + BALL_RADIUS > HEIGHT || state.ball.y - BALL_RADIUS < 0) {
        state.ball.dy *= -1;
        playSound(300, 'sine', 0.05);
      }

      // Paddle Collision
      let paddle = (state.ball.x < WIDTH / 2) ? state.player : state.cpu;
      if (checkCollision(state.ball, paddle)) {
        let hitPoint = (state.ball.y - (paddle.y + PADDLE_HEIGHT / 2)) / (PADDLE_HEIGHT / 2);
        let angle = hitPoint * (Math.PI / 4);
        let dir = (state.ball.x < WIDTH / 2) ? 1 : -1;
        
        state.ball.dx = dir * state.ball.speed * Math.cos(angle);
        state.ball.dy = state.ball.speed * Math.sin(angle);
        state.ball.speed += 0.25;

        createExplosion(state.ball.x, state.ball.y, paddle.color);
        playSound(dir === 1 ? 440 : 550, 'square', 0.1);
      }

      // Scoring
      if (state.ball.x < 0) {
        state.cpuScore++;
        playSound(150, 'sawtooth', 0.3);
        syncUI();
        handleGameOver();
        if (state.running) resetBall('cpu');
      } else if (state.ball.x > WIDTH) {
        state.playerScore++;
        if (state.playerScore % 2 === 0) state.level++;
        playSound(880, 'sine', 0.3);
        syncUI();
        handleGameOver();
        if (state.running) resetBall('player');
      }

      // Particles Update
      state.particles = state.particles.filter(p => p.alpha > 0);
      state.particles.forEach(p => p.update());
      
      // Only sync the speed UI regularly to avoid heavy re-renders
      setUiState(prev => ({ ...prev, speedWidth: Math.min((state.ball.speed - 7) * 10, 100) }));
    }

    // -- RENDER LOGIC --
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    // Center Net
    ctx.setLineDash([5, 10]);
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.strokeRect(WIDTH / 2, 0, 1, HEIGHT);
    ctx.setLineDash([]);

    // Trail
    state.ballTrail.forEach((t, i) => {
      ctx.beginPath();
      ctx.arc(t.x, t.y, BALL_RADIUS * (i / state.ballTrail.length), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(34, 211, 238, ${i / 20})`;
      ctx.fill();
    });

    // Particles
    state.particles.forEach(p => p.draw(ctx));

    // Paddles
    ctx.shadowBlur = 15;
    ctx.fillStyle = state.player.color;
    ctx.shadowColor = state.player.color;
    ctx.fillRect(state.player.x, state.player.y, PADDLE_WIDTH, PADDLE_HEIGHT);

    ctx.fillStyle = state.cpu.color;
    ctx.shadowColor = state.cpu.color;
    ctx.fillRect(state.cpu.x, state.cpu.y, PADDLE_WIDTH, PADDLE_HEIGHT);

    // Ball
    ctx.shadowBlur = 20;
    ctx.shadowColor = "#fff";
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(state.ball.x, state.ball.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    requestRef.current = requestAnimationFrame(updateAndRender);
  };

  const syncUI = () => {
    setUiState(prev => ({
      ...prev,
      playerScore: gameState.current.playerScore,
      cpuScore: gameState.current.cpuScore,
      level: gameState.current.level
    }));
  };

  // --- Event Listeners ---
  useEffect(() => {
    const handleMove = (e) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const scaleY = HEIGHT / rect.height;
      let newY = (clientY - rect.top) * scaleY - PADDLE_HEIGHT / 2;
      
      if (newY < 0) newY = 0;
      if (newY > HEIGHT - PADDLE_HEIGHT) newY = HEIGHT - PADDLE_HEIGHT;
      
      gameState.current.player.y = newY;
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('touchmove', handleMove, { passive: false });

    requestRef.current = requestAnimationFrame(updateAndRender);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('touchmove', handleMove);
      cancelAnimationFrame(requestRef.current);
    };
  }, []); // Empty dependency array ensures this runs once

  // --- Interaction ---
  const handleStart = () => {
    initAudio();
    setOverlay(prev => ({ ...prev, visible: false }));
    gameState.current.running = true;
    resetBall('player');
    syncUI();
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-white select-none relative w-full h-full font-orbitron bg-[#050507]">
      
      {/* Styles Injection */}
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap');
        
        .font-orbitron { font-family: 'Orbitron', sans-serif; }
        
        canvas {
          display: block;
          margin: auto;
          border: 2px solid #1e293b;
          box-shadow: 0 0 40px rgba(34, 211, 238, 0.1);
          border-radius: 12px;
          background: radial-gradient(circle at center, #111827 0%, #050507 100%);
          max-width: 95vw;
          max-height: 75vh;
        }

        .neon-glow-cyan { text-shadow: 0 0 15px rgba(34, 211, 238, 0.8); }
        .neon-glow-pink { text-shadow: 0 0 15px rgba(236, 72, 153, 0.8); }

        .shake { animation: shake 0.15s cubic-bezier(.36,.07,.19,.97) both; }

        @keyframes shake {
          10%, 90% { transform: translate3d(-1px, 0, 0); }
          20%, 80% { transform: translate3d(2px, 0, 0); }
          30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
          40%, 60% { transform: translate3d(4px, 0, 0); }
        }

        .custom-overlay {
          background: rgba(5, 5, 7, 0.85);
          backdrop-filter: blur(12px);
        }
      `}} />

      {/* HUD */}
      <div className="mb-6 flex gap-16 items-center">
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-500/60 mb-1">Player One</p>
          <h1 className="text-6xl font-black neon-glow-cyan text-cyan-400">{uiState.playerScore}</h1>
        </div>
        <div className="text-center group">
          <div className="px-4 py-1 border border-white/10 rounded-full mb-2">
            <p className="text-[10px] uppercase tracking-widest text-gray-500">Difficulty</p>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-widest">LVL {uiState.level.toString().padStart(2, '0')}</h1>
        </div>
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-[0.3em] text-pink-500/60 mb-1">CPU Alpha</p>
          <h1 className="text-6xl font-black neon-glow-pink text-pink-500">{uiState.cpuScore}</h1>
        </div>
      </div>

      {/* Game Wrapper for Shake Effect */}
      <div id="game-container" ref={containerRef} className="relative transition-transform duration-100 ease-out">
        <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} />
      </div>

      <div className="mt-6 flex flex-col items-center gap-2">
        <p className="text-gray-500 text-[10px] tracking-[0.2em] uppercase">Control: Mouse or Touch</p>
        <div className="h-1 w-32 bg-gray-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-cyan-500 transition-all duration-300" 
            style={{ width: `${uiState.speedWidth}%` }}
          ></div>
        </div>
      </div>

      {/* UI Overlay */}
      {overlay.visible && (
        <div className="fixed inset-0 flex items-center justify-center custom-overlay z-50">
          <div className="text-center p-12 border border-white/10 rounded-[2rem] bg-gray-900/40 shadow-2xl">
            <h2 className="text-5xl font-black mb-2 tracking-tighter italic text-white uppercase">{overlay.title}</h2>
            <p className="mb-8 text-cyan-500/80 text-sm tracking-widest uppercase">{overlay.msg}</p>
            <button 
              onClick={handleStart}
              className="group relative px-12 py-5 bg-white text-black font-black rounded-xl overflow-hidden transition-all hover:scale-105 active:scale-95"
            >
              <span className="relative z-10">{overlay.btnText}</span>
              <div className="absolute inset-0 bg-cyan-400 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
