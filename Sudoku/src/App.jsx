// By Manthan Vinzuda
import React, { useState, useEffect, useReducer, useCallback, memo, useMemo } from 'react';

// ==========================================
// 1. ENGINE: src/engine/SudokuEngine.js
// ==========================================
class SudokuEngine {
    constructor() {
        this.board = Array(81).fill(0);
        this.solution = Array(81).fill(0);
    }

    generate(difficulty = 'easy') {
        this.board = Array(81).fill(0);
        this._fillBoard(0);
        this.solution = [...this.board];
        
        let attempts = { 'easy': 35, 'medium': 45, 'hard': 54, 'expert': 60 }[difficulty];
        this._removeNumbers(attempts);
        return { board: this.board, solution: this.solution };
    }

    _isValid(board, index, num) {
        const row = Math.floor(index / 9);
        const col = index % 9;
        const boxRow = Math.floor(row / 3) * 3;
        const boxCol = Math.floor(col / 3) * 3;

        for (let i = 0; i < 9; i++) {
            if (board[row * 9 + i] === num) return false;
            if (board[i * 9 + col] === num) return false;
            const r = boxRow + Math.floor(i / 3);
            const c = boxCol + (i % 3);
            if (board[r * 9 + c] === num) return false;
        }
        return true;
    }

    _fillBoard(index) {
        if (index === 81) return true;
        let nums = [1,2,3,4,5,6,7,8,9].sort(() => Math.random() - 0.5);
        for (let num of nums) {
            if (this._isValid(this.board, index, num)) {
                this.board[index] = num;
                if (this._fillBoard(index + 1)) return true;
                this.board[index] = 0;
            }
        }
        return false;
    }

    _removeNumbers(count) {
        while (count > 0) {
            let idx = Math.floor(Math.random() * 81);
            if (this.board[idx] !== 0) {
                this.board[idx] = 0;
                count--;
            }
        }
    }
}

const engine = new SudokuEngine();

// ==========================================
// 2. STATE MANAGEMENT: src/hooks/useSudokuGame.js
// ==========================================
const initialState = {
    board: Array(81).fill(0),
    solution: Array(81).fill(0),
    fixed: Array(81).fill(false),
    notes: Array(81).fill([]),
    selected: -1,
    mistakes: 0,
    time: 0,
    difficulty: 'easy',
    notesMode: false,
    history: [],
    status: 'playing', // 'playing', 'won', 'lost'
    maxMistakes: 3
};

function gameReducer(state, action) {
    switch (action.type) {
        case 'NEW_GAME':
            return { 
                ...initialState, 
                ...action.payload, 
                difficulty: state.difficulty, 
                time: 0, 
                mistakes: 0, 
                status: 'playing' 
            };
        case 'SET_DIFFICULTY':
            return { ...state, difficulty: action.payload };
        case 'SELECT_CELL':
            return { ...state, selected: action.payload };
        case 'MOVE_SELECTION': {
            if (state.selected === -1) return state;
            const dir = action.payload;
            let next = state.selected;
            if (dir === 'UP') next -= 9;
            if (dir === 'DOWN') next += 9;
            if (dir === 'LEFT') next -= 1;
            if (dir === 'RIGHT') next += 1;
            if (next >= 0 && next < 81) return { ...state, selected: next };
            return state;
        }
        case 'TOGGLE_NOTES':
            return { ...state, notesMode: !state.notesMode };
        case 'TICK':
            return state.status === 'playing' ? { ...state, time: state.time + 1 } : state;
        case 'INPUT_NUMBER': {
            const num = action.payload;
            const idx = state.selected;
            if (idx === -1 || state.fixed[idx] || state.status !== 'playing') return state;

            const newHistory = [...state.history, {
                index: idx,
                prevVal: state.board[idx],
                prevNotes: state.notes[idx]
            }];

            if (state.notesMode && num !== 0) {
                const newNotes = [...state.notes];
                const cellNotes = state.notes[idx];
                newNotes[idx] = cellNotes.includes(num) 
                    ? cellNotes.filter(n => n !== num) 
                    : [...cellNotes, num];
                
                const newBoard = [...state.board];
                newBoard[idx] = 0; 
                return { ...state, notes: newNotes, board: newBoard, history: newHistory };
            } else {
                let newMistakes = state.mistakes;
                let newStatus = state.status;
                
                if (num !== 0 && num !== state.solution[idx]) {
                    newMistakes++;
                    if (newMistakes >= state.maxMistakes) newStatus = 'lost';
                }

                const newBoard = [...state.board];
                newBoard[idx] = num;

                const newNotes = [...state.notes];
                newNotes[idx] = []; 

                // Clear related notes if correct
                if (num !== 0 && num === state.solution[idx]) {
                    const row = Math.floor(idx / 9);
                    const col = idx % 9;
                    const br = Math.floor(row / 3) * 3;
                    const bc = Math.floor(col / 3) * 3;

                    for (let i = 0; i < 81; i++) {
                        const r = Math.floor(i / 9);
                        const c = i % 9;
                        const bbr = Math.floor(r / 3) * 3;
                        const bbc = Math.floor(c / 3) * 3;
                        if (r === row || c === col || (bbr === br && bbc === bc)) {
                            newNotes[i] = newNotes[i].filter(n => n !== num);
                        }
                    }
                }

                if (newBoard.every((val, i) => val === state.solution[i]) && newStatus === 'playing') {
                    newStatus = 'won';
                }

                return { ...state, board: newBoard, notes: newNotes, mistakes: newMistakes, status: newStatus, history: newHistory };
            }
        }
        case 'UNDO': {
            if (state.history.length === 0 || state.status !== 'playing') return state;
            const last = state.history[state.history.length - 1];
            const newBoard = [...state.board];
            newBoard[last.index] = last.prevVal;
            const newNotes = [...state.notes];
            newNotes[last.index] = last.prevNotes;
            return { ...state, board: newBoard, notes: newNotes, history: state.history.slice(0, -1) };
        }
        case 'HINT': {
            if (state.status !== 'playing') return state;
            let targetIdx = state.selected;
            if (targetIdx === -1 || state.board[targetIdx] !== 0) {
                targetIdx = state.board.findIndex(v => v === 0);
                if (targetIdx === -1) return state; 
            }
            
            const num = state.solution[targetIdx];
            const newBoard = [...state.board];
            newBoard[targetIdx] = num;
            const newNotes = [...state.notes];
            newNotes[targetIdx] = [];

            // Clear related notes
            const row = Math.floor(targetIdx / 9);
            const col = targetIdx % 9;
            const br = Math.floor(row / 3) * 3;
            const bc = Math.floor(col / 3) * 3;
            for (let i = 0; i < 81; i++) {
                const r = Math.floor(i / 9);
                const c = i % 9;
                const bbr = Math.floor(r / 3) * 3;
                const bbc = Math.floor(c / 3) * 3;
                if (r === row || c === col || (bbr === br && bbc === bc)) {
                    newNotes[i] = newNotes[i].filter(n => n !== num);
                }
            }

            let newStatus = state.status;
            if (newBoard.every((val, i) => val === state.solution[i])) newStatus = 'won';

            return { ...state, board: newBoard, notes: newNotes, status: newStatus, selected: targetIdx };
        }
        default:
            return state;
    }
}

function useSudokuGame() {
    const [state, dispatch] = useReducer(gameReducer, initialState);

    const startNewGame = useCallback((level = state.difficulty) => {
        const { board, solution } = engine.generate(level);
        const fixed = board.map(val => val !== 0);
        dispatch({ type: 'NEW_GAME', payload: { board, solution, fixed } });
    }, [state.difficulty]);

    useEffect(() => {
        startNewGame();
    }, []); // Init only once

    useEffect(() => {
        const timerId = setInterval(() => dispatch({ type: 'TICK' }), 1000);
        return () => clearInterval(timerId);
    }, []);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (state.status !== 'playing') return;
            if (e.key >= '1' && e.key <= '9') dispatch({ type: 'INPUT_NUMBER', payload: parseInt(e.key) });
            if (e.key === 'Backspace' || e.key === 'Delete') dispatch({ type: 'INPUT_NUMBER', payload: 0 });
            if (e.key === 'n' || e.key === 'N') dispatch({ type: 'TOGGLE_NOTES' });
            if (e.key === 'ArrowUp') dispatch({ type: 'MOVE_SELECTION', payload: 'UP' });
            if (e.key === 'ArrowDown') dispatch({ type: 'MOVE_SELECTION', payload: 'DOWN' });
            if (e.key === 'ArrowLeft') dispatch({ type: 'MOVE_SELECTION', payload: 'LEFT' });
            if (e.key === 'ArrowRight') dispatch({ type: 'MOVE_SELECTION', payload: 'RIGHT' });
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [state.status]);

    return { state, dispatch, startNewGame };
}

// ==========================================
// 3. COMPONENTS: src/components/*
// ==========================================

const SudokuCell = memo(({ index, value, isFixed, isSelected, isRelated, isSameNum, isError, notes, onClick }) => {
    let className = 'cell';
    if ((index + 1) % 3 === 0 && (index + 1) % 9 !== 0) className += ' bold-right';
    if (Math.floor(index / 9) === 2 || Math.floor(index / 9) === 5) className += ' bold-bottom';
    if (isSelected) className += ' selected';
    else if (isRelated) className += ' related';
    else if (isSameNum) className += ' highlight-same';
    
    if (isError) className += ' error';
    if (isFixed) className += ' fixed';
    if (!isFixed && value !== 0) className += ' user-value';

    return (
        <div className={className} onClick={() => onClick(index)}>
            {value !== 0 ? value : (
                notes.length > 0 && (
                    <div className="notes-grid">
                        {[1,2,3,4,5,6,7,8,9].map(n => (
                            <div key={n} className="note">{notes.includes(n) ? n : ''}</div>
                        ))}
                    </div>
                )
            )}
        </div>
    );
});

const SudokuBoard = ({ state, dispatch }) => {
    const handleCellClick = useCallback((index) => {
        dispatch({ type: 'SELECT_CELL', payload: index });
    }, [dispatch]);

    const { selected, board, solution, fixed, notes } = state;
    const selectedVal = selected !== -1 ? board[selected] : 0;
    
    const sRow = selected !== -1 ? Math.floor(selected / 9) : -1;
    const sCol = selected !== -1 ? selected % 9 : -1;
    const sBoxR = sRow !== -1 ? Math.floor(sRow / 3) * 3 : -1;
    const sBoxC = sCol !== -1 ? Math.floor(sCol / 3) * 3 : -1;

    return (
        <div className="board">
            {board.map((val, i) => {
                const r = Math.floor(i / 9);
                const c = i % 9;
                const br = Math.floor(r / 3) * 3;
                const bc = Math.floor(c / 3) * 3;

                const isSelected = i === selected;
                const isRelated = !isSelected && selected !== -1 && (r === sRow || c === sCol || (br === sBoxR && bc === sBoxC));
                const isSameNum = !isSelected && selectedVal !== 0 && val === selectedVal;
                const isError = !fixed[i] && val !== 0 && val !== solution[i];

                return (
                    <SudokuCell
                        key={i}
                        index={i}
                        value={val}
                        isFixed={fixed[i]}
                        isSelected={isSelected}
                        isRelated={isRelated}
                        isSameNum={isSameNum}
                        isError={isError}
                        notes={notes[i]}
                        onClick={handleCellClick}
                    />
                );
            })}
        </div>
    );
};

const DifficultySelector = ({ current, onSelect }) => (
    <div className="difficulty-selector">
        {['easy', 'medium', 'hard', 'expert'].map(level => (
            <span 
                key={level} 
                data-level={level} 
                className={current === level ? 'active' : ''}
                onClick={() => onSelect(level)}
            >
                {level.charAt(0).toUpperCase() + level.slice(1)}
            </span>
        ))}
    </div>
);

const StatsBar = ({ mistakes, maxMistakes, time }) => {
    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    return (
        <div className="stats-bar">
            <div className="stat-item">
                <span className="stat-label">Mistakes</span>
                <span>{mistakes}/{maxMistakes}</span>
            </div>
            <div className="stat-item">
                <span className="stat-label">Time</span>
                <span>{formatTime(time)}</span>
            </div>
        </div>
    );
};

const Controls = ({ state, dispatch, startNewGame }) => {
    return (
        <div className="controls">
            <div className="action-buttons">
                <button className="action-btn" onClick={() => dispatch({ type: 'UNDO' })}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 10h10a8 8 0 0 1 8 8v2M3 10l6-6M3 10l6 6"/></svg>
                    Undo
                </button>
                <button className="action-btn" onClick={() => dispatch({ type: 'INPUT_NUMBER', payload: 0 })}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20 20H7L3 16C2.5 15.5 2.5 14.5 3 14L15 2L22 9L20 11M20 20L13 13"/></svg>
                    Erase
                </button>
                <button className={`action-btn toggle-notes ${state.notesMode ? 'active' : ''}`} onClick={() => dispatch({ type: 'TOGGLE_NOTES' })}>
                    <div className="notes-badge">{state.notesMode ? 'ON' : 'OFF'}</div>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                    Notes
                </button>
                <button className="action-btn" onClick={() => dispatch({ type: 'HINT' })}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M9 18h6m-3-15a7 7 0 0 1 0 14h-1l-1 4h-2l-1-4h-1a7 7 0 0 1 0-14z"/></svg>
                    Hint
                </button>
            </div>

            <div className="numpad">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                    <button key={num} className="num-btn" onClick={() => dispatch({ type: 'INPUT_NUMBER', payload: num })}>
                        {num}
                    </button>
                ))}
            </div>

            <button className="new-game-btn" onClick={() => startNewGame(state.difficulty)}>
                New Game
            </button>
        </div>
    );
};

const GameModal = ({ status, time, startNewGame }) => {
    if (status === 'playing') return null;

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const isWin = status === 'won';

    return (
        <div className="modal-overlay" style={{ display: 'flex' }}>
            <div className="modal">
                <h2>{isWin ? 'Excellent!' : 'Game Over'}</h2>
                <p>
                    {isWin 
                        ? `You completed the Sudoku in ${formatTime(time)}.` 
                        : 'You reached the limit of mistakes.'}
                </p>
                <button className="new-game-btn" onClick={() => startNewGame()}>Try Again</button>
            </div>
        </div>
    );
};

// ==========================================
// 4. STYLES: src/styles/sudoku.css
// ==========================================
const GlobalStyles = () => (
    <style>{`
        :root {
            --primary: #4a6fa5;
            --bg-selected: #e2ebf3;
            --bg-related: #f0f4f8;
            --text-main: #334e68;
            --text-num: #2563eb;
            --error: #ef4444;
            --border: #cbd5e1;
            --border-thick: #64748b;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #f8fafc;
            color: var(--text-main);
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            user-select: none;
        }
        .game-container {
            display: flex;
            flex-direction: column;
            width: 100%;
            max-width: 900px;
            padding: 20px;
            gap: 20px;
            box-sizing: border-box;
        }
        .header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; }
        .difficulty-selector { display: flex; gap: 15px; font-size: 14px; font-weight: 600; color: #94a3b8; }
        .difficulty-selector span { cursor: pointer; transition: color 0.2s; }
        .difficulty-selector span.active { color: var(--primary); text-decoration: underline; text-underline-offset: 4px; }
        .stats-bar { display: flex; gap: 20px; font-size: 14px; font-weight: 500; align-items: center; }
        .stat-item { display: flex; flex-direction: column; align-items: flex-end; }
        .stat-label { font-size: 12px; color: #94a3b8; text-transform: uppercase; }
        .main-layout { display: grid; grid-template-columns: 1fr 300px; gap: 40px; }
        @media (max-width: 768px) { .main-layout { grid-template-columns: 1fr; } }
        .board {
            display: grid; grid-template-columns: repeat(9, 1fr); aspect-ratio: 1 / 1;
            border: 2px solid var(--border-thick); background-color: white;
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
        }
        .cell {
            border: 1px solid var(--border); display: flex; justify-content: center; align-items: center;
            font-size: clamp(1.2rem, 4vw, 2rem); cursor: pointer; position: relative; transition: background-color 0.1s;
        }
        .cell.bold-right { border-right: 2px solid var(--border-thick); }
        .cell.bold-bottom { border-bottom: 2px solid var(--border-thick); }
        .cell.selected { background-color: var(--bg-selected) !important; }
        .cell.related { background-color: var(--bg-related); }
        .cell.error { color: var(--error); }
        .cell.fixed { font-weight: bold; color: #1e293b; }
        .cell.user-value { color: var(--text-num); }
        .cell.highlight-same { background-color: #d1d5db; }
        .notes-grid {
            display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(3, 1fr);
            width: 100%; height: 100%; padding: 2px; box-sizing: border-box; pointer-events: none;
        }
        .note { font-size: 10px; color: #64748b; display: flex; justify-content: center; align-items: center; }
        .controls { display: flex; flex-direction: column; gap: 20px; }
        .action-buttons { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
        .action-btn {
            display: flex; flex-direction: column; align-items: center; gap: 5px;
            background: none; border: none; cursor: pointer; color: var(--primary);
            font-size: 12px; font-weight: 600; padding: 10px 5px; border-radius: 8px; transition: background 0.2s;
        }
        .action-btn:hover { background-color: #f1f5f9; }
        .action-btn svg { width: 24px; height: 24px; stroke-width: 2; }
        .action-btn.active { color: white; background-color: var(--primary); }
        .numpad { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .num-btn {
            aspect-ratio: 1.2 / 1; background-color: #f1f5f9; border: none; border-radius: 8px;
            font-size: 24px; font-weight: 500; color: var(--text-num); cursor: pointer; transition: all 0.2s;
        }
        .num-btn:hover { background-color: #e2e8f0; }
        .num-btn:active { transform: scale(0.95); }
        .new-game-btn {
            background-color: var(--primary); color: white; border: none; border-radius: 12px;
            padding: 15px; font-size: 18px; font-weight: 600; cursor: pointer; margin-top: 10px; transition: opacity 0.2s;
        }
        .new-game-btn:hover { opacity: 0.9; }
        .modal-overlay {
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 100;
        }
        .modal { background: white; padding: 30px; border-radius: 16px; text-align: center; max-width: 300px; width: 90%; }
        .toggle-notes { position: relative; }
        .notes-badge {
            position: absolute; top: -5px; right: -5px; background: #475569;
            color: white; font-size: 8px; padding: 2px 4px; border-radius: 4px;
        }
    `}</style>
);

// ==========================================
// 5. MAIN COMPONENT: src/App.jsx
// ==========================================
export default function App() {
    const { state, dispatch, startNewGame } = useSudokuGame();

    const handleDifficultySelect = (level) => {
        dispatch({ type: 'SET_DIFFICULTY', payload: level });
        startNewGame(level);
    };

    return (
        <>
            <GlobalStyles />
            <div className="game-container">
                <div className="header">
                    <DifficultySelector 
                        current={state.difficulty} 
                        onSelect={handleDifficultySelect} 
                    />
                    <StatsBar 
                        mistakes={state.mistakes} 
                        maxMistakes={state.maxMistakes} 
                        time={state.time} 
                    />
                </div>

                <div className="main-layout">
                    <SudokuBoard state={state} dispatch={dispatch} />
                    <Controls 
                        state={state} 
                        dispatch={dispatch} 
                        startNewGame={startNewGame} 
                    />
                </div>
            </div>

            <GameModal 
                status={state.status} 
                time={state.time} 
                startNewGame={() => startNewGame(state.difficulty)} 
            />
        </>
    );
}
