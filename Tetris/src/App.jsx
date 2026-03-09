import React, { useState, useEffect, useRef, useCallback } from 'react';

// --- GAME CONSTANTS ---
const BLOCK_SIZE = 30;
const COLS = 10;
const ROWS = 20;

const COLORS = [
    null,
    '#00ffff', // 1: Cyan (I)
    '#0055ff', // 2: Blue (J)
    '#ffaa00', // 3: Orange (L)
    '#ffff00', // 4: Yellow (O)
    '#00ff00', // 5: Green (S)
    '#aa00ff', // 6: Purple (T)
    '#ff0055'  // 7: Red (Z)
];

const SHAPES = [
    [], // 0 is empty
    [[0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0]], // 1: I
    [[0, 2, 0], [0, 2, 0], [2, 2, 0]], // 2: J
    [[0, 3, 0], [0, 3, 0], [0, 3, 3]], // 3: L
    [[4, 4], [4, 4]], // 4: O
    [[0, 5, 5], [5, 5, 0], [0, 0, 0]], // 5: S
    [[0, 0, 0], [6, 6, 6], [0, 6, 0]], // 6: T
    [[7, 7, 0], [0, 7, 7], [0, 0, 0]]  // 7: Z
];

export default function App() {
    // --- REACT STATE FOR UI ---
    const [score, setScore] = useState(0);
    const [lines, setLines] = useState(0);
    const [level, setLevel] = useState(1);
    const [gameState, setGameState] = useState('START'); // START, PLAYING, PAUSED, GAMEOVER

    // --- REFS ---
    const canvasRef = useRef(null);
    const nextCanvasRef = useRef(null);
    const engineRef = useRef(null);
    const touchIntervalRef = useRef(null);

    // --- MAIN GAME ENGINE (Isolated to prevent React state closure bugs during 60FPS loop) ---
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const nextCanvas = nextCanvasRef.current;
        const nextCtx = nextCanvas.getContext('2d');

        // Reset transforms for hot-reloading stability
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        nextCtx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(BLOCK_SIZE, BLOCK_SIZE);
        nextCtx.scale(BLOCK_SIZE, BLOCK_SIZE);

        // Local Engine State
        let arena = createMatrix(COLS, ROWS);
        let player = { pos: { x: 0, y: 0 }, matrix: null, score: 0, lines: 0, level: 1 };
        let nextMatrix = null;
        let dropCounter = 0;
        let dropInterval = 1000;
        let lastTime = 0;
        let isGameOver = false;
        let isPaused = false;
        let animationId = null;

        // --- CORE FUNCTIONS ---
        function createMatrix(w, h) {
            const matrix = [];
            while (h--) { matrix.push(new Array(w).fill(0)); }
            return matrix;
        }

        function randomPiece() {
            const pieces = '1234567';
            const type = pieces[Math.floor(Math.random() * pieces.length)];
            return SHAPES[type];
        }

        function drawBlock(context, x, y, colorIndex, isGhost = false) {
            const color = COLORS[colorIndex];
            if (!color) return;

            context.fillStyle = isGhost ? 'transparent' : color;
            context.fillRect(x, y, 1, 1);

            if (isGhost) {
                context.strokeStyle = color;
                context.lineWidth = 0.05;
                context.globalAlpha = 0.5;
                context.strokeRect(x + 0.05, y + 0.05, 0.9, 0.9);
                context.globalAlpha = 1.0;
            } else {
                context.fillStyle = 'rgba(255, 255, 255, 0.3)';
                context.beginPath();
                context.moveTo(x, y);
                context.lineTo(x + 1, y);
                context.lineTo(x + 0.8, y + 0.2);
                context.lineTo(x + 0.2, y + 0.2);
                context.fill();

                context.beginPath();
                context.moveTo(x, y);
                context.lineTo(x, y + 1);
                context.lineTo(x + 0.2, y + 0.8);
                context.lineTo(x + 0.2, y + 0.2);
                context.fill();

                context.fillStyle = 'rgba(0, 0, 0, 0.4)';
                context.beginPath();
                context.moveTo(x, y + 1);
                context.lineTo(x + 1, y + 1);
                context.lineTo(x + 0.8, y + 0.8);
                context.lineTo(x + 0.2, y + 0.8);
                context.fill();

                context.beginPath();
                context.moveTo(x + 1, y);
                context.lineTo(x + 1, y + 1);
                context.lineTo(x + 0.8, y + 0.8);
                context.lineTo(x + 0.8, y + 0.2);
                context.fill();

                context.strokeStyle = 'rgba(255, 255, 255, 0.1)';
                context.lineWidth = 0.05;
                context.strokeRect(x + 0.1, y + 0.1, 0.8, 0.8);
            }
        }

        function drawMatrix(matrix, offset, context, isGhost = false) {
            matrix.forEach((row, y) => {
                row.forEach((value, x) => {
                    if (value !== 0) {
                        drawBlock(context, x + offset.x, y + offset.y, value, isGhost);
                    }
                });
            });
        }

        function getGhostPos() {
            const ghost = { matrix: player.matrix, pos: { x: player.pos.x, y: player.pos.y } };
            while (!collide(arena, ghost)) { ghost.pos.y++; }
            ghost.pos.y--; 
            return ghost.pos;
        }

        function draw() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            drawMatrix(arena, { x: 0, y: 0 }, ctx);

            if (player.matrix) {
                const ghostPos = getGhostPos();
                drawMatrix(player.matrix, ghostPos, ctx, true);
                drawMatrix(player.matrix, player.pos, ctx);
            }

            nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
            if (nextMatrix) {
                const offset = {
                    x: nextMatrix[0].length === 2 ? 1 : 0.5,
                    y: nextMatrix.length === 2 ? 1 : 1
                };
                if (nextMatrix.length === 4) { offset.x = 0; offset.y = 0; }
                drawMatrix(nextMatrix, offset, nextCtx);
            }
        }

        function collide(board, obj) {
            const m = obj.matrix;
            const o = obj.pos;
            for (let y = 0; y < m.length; ++y) {
                for (let x = 0; x < m[y].length; ++x) {
                    if (m[y][x] !== 0 && (board[y + o.y] && board[y + o.y][x + o.x]) !== 0) {
                        return true;
                    }
                }
            }
            return false;
        }

        function merge(board, p) {
            p.matrix.forEach((row, y) => {
                row.forEach((value, x) => {
                    if (value !== 0) { board[y + p.pos.y][x + p.pos.x] = value; }
                });
            });
        }

        function rotate(matrix, dir) {
            for (let y = 0; y < matrix.length; ++y) {
                for (let x = 0; x < y; ++x) {
                    [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
                }
            }
            if (dir > 0) matrix.forEach(row => row.reverse());
            else matrix.reverse();
        }

        // --- PLAYER ACTIONS ---
        function playerDrop() {
            player.pos.y++;
            if (collide(arena, player)) {
                player.pos.y--;
                merge(arena, player);
                playerReset();
                arenaSweep();
                updateUIStats();
            }
            dropCounter = 0;
        }

        function hardDrop() {
            while (!collide(arena, player)) { player.pos.y++; }
            player.pos.y--;
            merge(arena, player);
            playerReset();
            arenaSweep();
            updateUIStats();
            dropCounter = 0;
        }

        function playerMove(offset) {
            player.pos.x += offset;
            if (collide(arena, player)) { player.pos.x -= offset; }
        }

        function playerRotate(dir) {
            const pos = player.pos.x;
            let offset = 1;
            rotate(player.matrix, dir);
            while (collide(arena, player)) {
                player.pos.x += offset;
                offset = -(offset + (offset > 0 ? 1 : -1));
                if (offset > player.matrix[0].length) {
                    rotate(player.matrix, -dir);
                    player.pos.x = pos;
                    return;
                }
            }
        }

        function playerReset() {
            if (!nextMatrix) { nextMatrix = randomPiece(); }
            player.matrix = nextMatrix;
            nextMatrix = randomPiece();
            player.pos.y = 0;
            player.pos.x = Math.floor(COLS / 2) - Math.floor(player.matrix[0].length / 2);

            if (collide(arena, player)) { gameOver(); }
        }

        function arenaSweep() {
            let rowCount = 1;
            outer: for (let y = arena.length - 1; y >= 0; --y) {
                for (let x = 0; x < arena[y].length; ++x) {
                    if (arena[y][x] === 0) continue outer;
                }
                const row = arena.splice(y, 1)[0].fill(0);
                arena.unshift(row);
                ++y;
                player.score += rowCount * 100 * player.level;
                player.lines++;
                rowCount *= 2;
            }
            player.level = Math.floor(player.lines / 10) + 1;
            dropInterval = Math.max(100, 1000 - (player.level - 1) * 100);
        }

        function updateUIStats() {
            setScore(player.score);
            setLines(player.lines);
            setLevel(player.level);
        }

        // --- GAME LOOP ---
        function update(time = 0) {
            if (isGameOver || isPaused) return;
            const deltaTime = time - lastTime;
            lastTime = time;

            dropCounter += deltaTime;
            if (dropCounter > dropInterval) {
                playerDrop();
            }

            draw();
            animationId = requestAnimationFrame(update);
        }

        // --- STATE MANAGERS ---
        function startGameEngine() {
            arena = createMatrix(COLS, ROWS);
            player.score = 0;
            player.lines = 0;
            player.level = 1;
            dropInterval = 1000;
            updateUIStats();

            isGameOver = false;
            isPaused = false;
            setGameState('PLAYING');

            nextMatrix = randomPiece();
            playerReset();

            lastTime = performance.now();
            update();
        }

        function gameOver() {
            isGameOver = true;
            cancelAnimationFrame(animationId);
            setGameState('GAMEOVER');
        }

        function togglePauseEngine() {
            if (isGameOver) return;
            isPaused = !isPaused;
            if (isPaused) {
                cancelAnimationFrame(animationId);
                setGameState('PAUSED');
            } else {
                setGameState('PLAYING');
                lastTime = performance.now();
                update();
            }
        }

        // Map inputs to game logic
        const handleKeyDown = (event) => {
            if (isGameOver) return;
            switch (event.keyCode) {
                case 37: if (!isPaused) { playerMove(-1); draw(); } break; // Left
                case 39: if (!isPaused) { playerMove(1); draw(); } break; // Right
                case 40: if (!isPaused) { playerDrop(); draw(); } break; // Down
                case 38: if (!isPaused) { playerRotate(1); draw(); } break; // Up
                case 32: if (!isPaused) { hardDrop(); draw(); } break; // Space
                case 80: togglePauseEngine(); break; // P
                default: break;
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        // Expose engine methods to React component
        engineRef.current = {
            start: startGameEngine,
            pause: togglePauseEngine,
            move: (dir) => { if (!isPaused && !isGameOver) { playerMove(dir); draw(); } },
            drop: () => { if (!isPaused && !isGameOver) { playerDrop(); draw(); } },
            rotate: () => { if (!isPaused && !isGameOver) { playerRotate(1); draw(); } },
            hardDrop: () => { if (!isPaused && !isGameOver) { hardDrop(); draw(); } }
        };

        // Initial Draw Background
        draw();

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            cancelAnimationFrame(animationId);
        };
    }, []); // Empty dependency array ensures this sets up once and runs stably

    // --- TOUCH HANDLERS ---
    const handleTouchStart = useCallback((action, holdAction = null) => (e) => {
        if (e && e.preventDefault) e.preventDefault(); // Prevents double tap zooming
        if (gameState !== 'PLAYING') return;

        if (engineRef.current && engineRef.current[action]) {
            engineRef.current[action](... (action === 'move' ? [holdAction] : [])); // pass direction if moving
        }

        if (holdAction !== null && action === 'move') {
            touchIntervalRef.current = setInterval(() => {
                if (engineRef.current) engineRef.current.move(holdAction);
            }, 100);
        } else if (action === 'drop') {
             touchIntervalRef.current = setInterval(() => {
                if (engineRef.current) engineRef.current.drop();
            }, 100);
        }
    }, [gameState]);

    const handleTouchEnd = useCallback((e) => {
        if (e && e.preventDefault) e.preventDefault();
        clearInterval(touchIntervalRef.current);
    }, []);

    // --- RENDER ---
    return (
        <>
            {/* INJECTED CSS TO MAINTAIN EXACT NEON STYLING */}
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap');
                
                :root {
                    --bg-color: #05050a;
                    --panel-bg: rgba(20, 20, 35, 0.7);
                    --border-color: rgba(0, 255, 255, 0.3);
                    --text-glow: 0 0 10px rgba(0, 255, 255, 0.8);
                    --neon-cyan: #0ff;
                    --neon-pink: #f0f;
                }

                * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; }

                body {
                    background-color: var(--bg-color);
                    background-image: 
                        radial-gradient(circle at 15% 50%, rgba(0, 255, 255, 0.08) 0%, transparent 50%),
                        radial-gradient(circle at 85% 30%, rgba(255, 0, 255, 0.08) 0%, transparent 50%);
                    color: #fff;
                    font-family: 'Orbitron', sans-serif;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    overflow: hidden;
                    touch-action: none;
                }

                h1 {
                    font-size: 2.5rem;
                    text-transform: uppercase;
                    letter-spacing: 4px;
                    margin-bottom: 20px;
                    text-shadow: 0 0 15px var(--neon-cyan), 0 0 30px var(--neon-cyan);
                    font-weight: 900;
                }

                .game-wrapper {
                    display: flex;
                    gap: 20px;
                    align-items: flex-start;
                    z-index: 10;
                }

                .side-panel {
                    background: var(--panel-bg);
                    border: 1px solid var(--border-color);
                    border-radius: 12px;
                    padding: 20px;
                    width: 160px;
                    backdrop-filter: blur(10px);
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), inset 0 0 20px rgba(0, 255, 255, 0.05);
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }

                .stat-box { text-align: center; }

                .stat-label {
                    font-size: 0.8rem;
                    color: #aaa;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    margin-bottom: 5px;
                }

                .stat-value {
                    font-size: 1.8rem;
                    font-weight: 700;
                    color: var(--neon-cyan);
                    text-shadow: var(--text-glow);
                }

                .canvas-container {
                    position: relative;
                    background: rgba(0, 0, 0, 0.8);
                    border: 2px solid var(--border-color);
                    border-radius: 8px;
                    box-shadow: 0 0 20px rgba(0, 255, 255, 0.2), inset 0 0 40px rgba(0, 0, 0, 0.8);
                    padding: 4px;
                }

                canvas {
                    display: block;
                    background: repeating-linear-gradient(
                        0deg, transparent, transparent 29px, rgba(255, 255, 255, 0.03) 29px, rgba(255, 255, 255, 0.03) 30px
                    ),
                    repeating-linear-gradient(
                        90deg, transparent, transparent 29px, rgba(255, 255, 255, 0.03) 29px, rgba(255, 255, 255, 0.03) 30px
                    );
                    background-size: 30px 30px;
                }

                #next-piece { background: none; margin: 0 auto; }

                .controls-hint {
                    font-family: monospace;
                    font-size: 0.8rem;
                    color: #888;
                    line-height: 1.8;
                    margin-top: auto;
                }
                .controls-hint span { color: #fff; font-weight: bold; }

                .overlay {
                    position: absolute;
                    top: 0; left: 0;
                    width: 100%; height: 100%;
                    background: rgba(0, 0, 0, 0.85);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    border-radius: 6px;
                    backdrop-filter: blur(4px);
                    z-index: 20;
                    transition: opacity 0.3s ease;
                }

                .overlay h2 {
                    font-size: 2rem;
                    color: var(--neon-pink);
                    text-shadow: 0 0 15px var(--neon-pink);
                    margin-bottom: 20px;
                }

                .btn {
                    background: transparent;
                    color: var(--neon-cyan);
                    border: 2px solid var(--neon-cyan);
                    padding: 12px 30px;
                    font-family: 'Orbitron', sans-serif;
                    font-size: 1.2rem;
                    font-weight: bold;
                    border-radius: 30px;
                    cursor: pointer;
                    text-transform: uppercase;
                    box-shadow: 0 0 10px rgba(0, 255, 255, 0.2), inset 0 0 10px rgba(0, 255, 255, 0.2);
                    transition: all 0.2s;
                }

                .btn:hover {
                    background: var(--neon-cyan);
                    color: #000;
                    box-shadow: 0 0 20px var(--neon-cyan);
                }

                .mobile-controls {
                    display: none;
                    width: 100%;
                    max-width: 400px;
                    margin-top: 20px;
                    gap: 10px;
                    z-index: 10;
                }

                .d-pad, .action-buttons { display: flex; gap: 10px; }
                .d-pad { flex: 1; justify-content: center; }
                .action-buttons { flex: 1; justify-content: center; }

                .ctrl-btn {
                    background: rgba(20, 20, 35, 0.8);
                    border: 1px solid var(--border-color);
                    color: #fff;
                    width: 60px; height: 60px;
                    border-radius: 50%;
                    font-size: 1.5rem;
                    display: flex; align-items: center; justify-content: center;
                    backdrop-filter: blur(5px);
                    cursor: pointer;
                    user-select: none;
                }

                .ctrl-btn:active {
                    background: rgba(0, 255, 255, 0.3);
                    box-shadow: 0 0 15px rgba(0, 255, 255, 0.5);
                }

                .btn-large {
                    width: 80px; height: 80px;
                    border-radius: 50%;
                    border-color: var(--neon-pink);
                    color: var(--neon-pink);
                }
                .btn-large:active {
                    background: rgba(255, 0, 255, 0.3);
                    box-shadow: 0 0 15px rgba(255, 0, 255, 0.5);
                }

                @media (max-width: 768px) {
                    h1 { font-size: 1.8rem; margin-bottom: 10px; }
                    .game-wrapper { flex-direction: column; align-items: center; gap: 10px; }
                    .side-panel {
                        flex-direction: row;
                        width: 100%; max-width: 300px;
                        padding: 10px;
                        justify-content: space-around;
                        height: auto;
                    }
                    .side-panel.right { display: none; }
                    .mobile-controls { display: flex; }
                }
            `}</style>

            <h1>Neon Tetris</h1>

            <div className="game-wrapper">
                {/* Left Stats Panel */}
                <div className="side-panel left">
                    <div className="stat-box">
                        <div className="stat-label">Score</div>
                        <div className="stat-value">{score}</div>
                    </div>
                    <div className="stat-box">
                        <div className="stat-label">Lines</div>
                        <div className="stat-value">{lines}</div>
                    </div>
                    <div className="stat-box">
                        <div className="stat-label">Level</div>
                        <div className="stat-value">{level}</div>
                    </div>
                </div>

                {/* Main Game Canvas */}
                <div className="canvas-container">
                    <canvas ref={canvasRef} id="tetris" width="300" height="600"></canvas>
                    
                    {/* Overlays */}
                    {gameState === 'START' && (
                        <div className="overlay">
                            <button className="btn" onClick={() => engineRef.current?.start()}>Start Game</button>
                        </div>
                    )}
                    
                    {gameState === 'GAMEOVER' && (
                        <div className="overlay">
                            <h2>GAME OVER</h2>
                            <div style={{ marginBottom: '20px', fontSize: '1.2rem' }}>
                                Final Score: <span style={{ color: 'var(--neon-cyan)' }}>{score}</span>
                            </div>
                            <button className="btn" onClick={() => engineRef.current?.start()}>Play Again</button>
                        </div>
                    )}

                    {gameState === 'PAUSED' && (
                        <div className="overlay">
                            <h2>PAUSED</h2>
                            <button className="btn" onClick={() => engineRef.current?.pause()}>Resume</button>
                        </div>
                    )}
                </div>

                {/* Right Preview Panel */}
                <div className="side-panel right">
                    <div className="stat-box">
                        <div className="stat-label">Next</div>
                        <canvas ref={nextCanvasRef} id="next-piece" width="120" height="120"></canvas>
                    </div>
                    <div className="controls-hint">
                        <div><span>← / →</span> Move</div>
                        <div><span>↑</span> Rotate</div>
                        <div><span>↓</span> Soft Drop</div>
                        <div><span>Space</span> Hard Drop</div>
                        <div><span>P</span> Pause</div>
                    </div>
                </div>
            </div>

            {/* Mobile Controls */}
            <div className="mobile-controls">
                <div className="d-pad">
                    <div className="ctrl-btn" 
                         onTouchStart={handleTouchStart('move', -1)} 
                         onTouchEnd={handleTouchEnd} 
                         onTouchCancel={handleTouchEnd}>←</div>
                    <div className="ctrl-btn" style={{ transform: 'translateY(20px)' }} 
                         onTouchStart={handleTouchStart('drop')} 
                         onTouchEnd={handleTouchEnd} 
                         onTouchCancel={handleTouchEnd}>↓</div>
                    <div className="ctrl-btn" 
                         onTouchStart={handleTouchStart('move', 1)} 
                         onTouchEnd={handleTouchEnd} 
                         onTouchCancel={handleTouchEnd}>→</div>
                </div>
                <div className="action-buttons">
                    <div className="ctrl-btn btn-large" 
                         onTouchStart={handleTouchStart('rotate')} 
                         onTouchEnd={handleTouchEnd} 
                         onTouchCancel={handleTouchEnd}>↻</div>
                    <div className="ctrl-btn btn-large" style={{ borderColor: 'var(--neon-cyan)', color: 'var(--neon-cyan)' }} 
                         onTouchStart={handleTouchStart('hardDrop')} 
                         onTouchEnd={handleTouchEnd} 
                         onTouchCancel={handleTouchEnd}>⤓</div>
                </div>
            </div>
        </>
    );
}