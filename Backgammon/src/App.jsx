// By Manthan Vinzuda 
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

// --- GAME LOGIC UTILS ---
const BOARD_SIZE = 24;
const P1 = 1; // White
const P2 = 2; // Black

const getPipCount = (s, player) => {
    let pips = 0;
    for (let i = 0; i < BOARD_SIZE; i++) {
        if (s.board[i].p === player) {
            pips += s.board[i].c * (player === P1 ? (i + 1) : (24 - i));
        }
    }
    pips += s.bar[player] * 25;
    return pips;
};

const cloneState = (s) => ({
    board: s.board.map(pt => ({ ...pt })),
    bar: { ...s.bar },
    off: { ...s.off },
    turn: s.turn,
    dice: [...s.dice],
    originalDice: [...s.originalDice],
    diceRolled: s.diceRolled,
});

const canLandOn = (s, idx, player) => {
    let pt = s.board[idx];
    return pt.p === 0 || pt.p === player || (pt.p !== player && pt.c === 1);
};

const getValidMovesForDie = (s, player, die) => {
    let moves = [];
    let dir = (player === P1) ? -1 : 1;

    if (s.bar[player] > 0) {
        let enterIdx = (player === P1) ? 24 - die : die - 1;
        if (canLandOn(s, enterIdx, player)) {
            moves.push({ from: 'bar', to: enterIdx, die: die });
        }
        return moves;
    }

    let canBearOff = true;
    for (let i = 0; i < BOARD_SIZE; i++) {
        if (s.board[i].p === player && s.board[i].c > 0) {
            if (player === P1 && i > 5) canBearOff = false;
            if (player === P2 && i < 18) canBearOff = false;
        }
    }

    for (let i = 0; i < BOARD_SIZE; i++) {
        if (s.board[i].p === player && s.board[i].c > 0) {
            let target = i + (dir * die);
            if (target >= 0 && target < BOARD_SIZE) {
                if (canLandOn(s, target, player)) {
                    moves.push({ from: i, to: target, die: die });
                }
            } else if (canBearOff) {
                if (player === P1 && target === -1) {
                    moves.push({ from: i, to: 'off', die: die });
                } else if (player === P2 && target === 24) {
                    moves.push({ from: i, to: 'off', die: die });
                } else if ((player === P1 && target < -1) || (player === P2 && target > 24)) {
                    let hasFurtherBack = false;
                    if (player === P1) {
                        for (let j = i + 1; j <= 5; j++) {
                            if (s.board[j].p === player && s.board[j].c > 0) { hasFurtherBack = true; break; }
                        }
                    } else {
                        for (let j = i - 1; j >= 18; j--) {
                            if (s.board[j].p === player && s.board[j].c > 0) { hasFurtherBack = true; break; }
                        }
                    }
                    if (!hasFurtherBack) {
                        moves.push({ from: i, to: 'off', die: die });
                    }
                }
            }
        }
    }
    return moves;
};

const applyMoveToState = (s, move, player) => {
    let ns = cloneState(s);
    if (move.from === 'bar') {
        ns.bar[player]--;
    } else {
        ns.board[move.from].c--;
        if (ns.board[move.from].c === 0) ns.board[move.from].p = 0;
    }

    if (move.to === 'off') {
        ns.off[player]++;
    } else {
        let pt = ns.board[move.to];
        if (pt.p !== player && pt.c === 1) {
            let opp = player === P1 ? P2 : P1;
            ns.bar[opp]++;
            pt.p = player;
            pt.c = 1;
        } else {
            pt.p = player;
            pt.c++;
        }
    }
    return ns;
};

const getLegalTurns = (s, player, diceRemaining) => {
    let turns = [];
    let uniqueDice = [...new Set(diceRemaining)];

    for (let d of uniqueDice) {
        let moves = getValidMovesForDie(s, player, d);
        for (let m of moves) {
            let ns = applyMoveToState(s, m, player);
            let nextDice = [...diceRemaining];
            nextDice.splice(nextDice.indexOf(d), 1);

            if (nextDice.length > 0) {
                let subTurns = getLegalTurns(ns, player, nextDice);
                if (subTurns.length > 0) {
                    for (let st of subTurns) turns.push([m, ...st]);
                } else {
                    turns.push([m]);
                }
            } else {
                turns.push([m]);
            }
        }
    }

    if (turns.length === 0) return [];
    let maxLen = Math.max(...turns.map(t => t.length));
    turns = turns.filter(t => t.length === maxLen);

    if (maxLen === 1 && s.originalDice.length === 2 && s.originalDice[0] !== s.originalDice[1]) {
        let maxDie = Math.max(...s.originalDice);
        let hasMaxDieMove = turns.some(t => t[0].die === maxDie);
        if (hasMaxDieMove) {
            turns = turns.filter(t => t[0].die === maxDie);
        }
    }
    return turns;
};

const evaluateBoard = (s, player) => {
    let score = 0;
    let opp = player === P1 ? P2 : P1;

    score += (getPipCount(s, opp) - getPipCount(s, player)) * 2;
    score += s.off[player] * 300;
    score -= s.off[opp] * 300;
    score -= s.bar[player] * 150;
    score += s.bar[opp] * 150;

    for (let i = 0; i < BOARD_SIZE; i++) {
        let pt = s.board[i];
        if (pt.p === player) {
            if (pt.c > 1) {
                score += 15;
                if ((player === P1 && i <= 5) || (player === P2 && i >= 18)) score += 20;
            } else if (pt.c === 1) {
                score -= s.bar[opp] > 0 ? 30 : 15;
            }
        } else if (pt.p === opp) {
            if (pt.c === 1) score += 10;
        }
    }
    return score;
};

const createInitialState = () => {
    let board = new Array(BOARD_SIZE).fill(null).map(() => ({ p: 0, c: 0 }));
    board[0] = { p: P2, c: 2 };
    board[5] = { p: P1, c: 5 };
    board[7] = { p: P1, c: 3 };
    board[11] = { p: P2, c: 5 };
    board[12] = { p: P1, c: 5 };
    board[16] = { p: P2, c: 3 };
    board[18] = { p: P2, c: 5 };
    board[23] = { p: P1, c: 2 };

    return {
        board,
        bar: { 1: 0, 2: 0 },
        off: { 1: 0, 2: 0 },
        turn: P1,
        dice: [],
        originalDice: [],
        diceRolled: false
    };
};

// --- HOOKS ---

const useSound = () => {
    const [soundEnabled, setSoundEnabled] = useState(true);
    const audioCtxRef = useRef(null);

    const initAudio = () => {
        if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
    };

    const playTone = useCallback((type, freq, duration, vol, isSweep = false) => {
        if (!soundEnabled) return;
        initAudio();
        const ctx = audioCtxRef.current;
        if (ctx.state === 'suspended') ctx.resume();

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        if (isSweep) {
            osc.frequency.exponentialRampToValueAtTime(freq / 4, ctx.currentTime + duration);
        }

        gain.gain.setValueAtTime(vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
    }, [soundEnabled]);

    const playRoll = useCallback(() => {
        if (!soundEnabled) return;
        let count = 0;
        let int = setInterval(() => {
            playTone('square', 200 + Math.random() * 200, 0.05, 0.05);
            count++;
            if (count > 6) clearInterval(int);
        }, 50);
    }, [soundEnabled, playTone]);

    const playClick = useCallback(() => playTone('sine', 600, 0.1, 0.1), [playTone]);
    const playHit = useCallback(() => playTone('square', 100, 0.2, 0.2, true), [playTone]);
    const playError = useCallback(() => playTone('sawtooth', 150, 0.3, 0.1), [playTone]);
    const playWin = useCallback(() => {
        setTimeout(() => playTone('sine', 400, 0.2, 0.2), 0);
        setTimeout(() => playTone('sine', 500, 0.2, 0.2), 200);
        setTimeout(() => playTone('sine', 600, 0.4, 0.2), 400);
    }, [playTone]);

    return { soundEnabled, setSoundEnabled, playRoll, playClick, playHit, playError, playWin };
};


// --- COMPONENTS ---

const Checker = React.memo(({ player, isSelected, isPlayable, count, isTop, index }) => {
    const classes = [
        'checker',
        `p${player}`,
        isSelected ? 'selected' : '',
        isPlayable ? 'playable' : ''
    ].filter(Boolean).join(' ');

    return (
        <div className={classes} style={{ zIndex: isSelected ? 100 : 1 }}>
            {count > 5 && isTop && <div className="badge">{count}</div>}
        </div>
    );
});

const Point = React.memo(({ idx, rowType, ptData, onClick, isHighlighted, playablePlayer, isSelectedId }) => {
    const checkers = [];
    let isPlayable = false;
    let isSelected = false;

    if (ptData.c > 0) {
         // Determine if the top checker on this point should be playable or selected
         isPlayable = playablePlayer === ptData.p;
         isSelected = isSelectedId === idx;

        for (let i = 0; i < ptData.c; i++) {
             let isTop = i === ptData.c - 1;
             checkers.push(
                <Checker
                    key={`${idx}-${i}`}
                    player={ptData.p}
                    isTop={isTop}
                    count={ptData.c}
                    isPlayable={isTop && isPlayable && !isSelected}
                    isSelected={isTop && isSelected}
                />
            );
        }
    }

    return (
        <div className={`point ${rowType} ${isHighlighted ? 'highlight' : ''}`} onClick={() => onClick(idx)}>
            <div className={`checkers-container ${rowType === 'top-row' ? 'align-top' : 'align-bottom'}`}>
                {checkers}
            </div>
        </div>
    );
});


const App = () => {
    // Hooks
    const { soundEnabled, setSoundEnabled, playRoll, playClick, playHit, playError, playWin } = useSound();
    
    // Game State
    const [gameState, setGameState] = useState(createInitialState());
    const [history, setHistory] = useState([]);
    const [mode, setMode] = useState('ai');
    
    // UI State
    const [selectedLoc, setSelectedLoc] = useState(null); // idx or 'bar1'/'bar2'
    const [validTargets, setValidTargets] = useState([]);
    const [notification, setNotification] = useState(null);
    const [isRolling, setIsRolling] = useState(false);
    const [aiQueue, setAiQueue] = useState([]);
    
    const aiTimeoutRef = useRef(null);

    // Derived State
    const allValidTurns = useMemo(() => {
        if (!gameState.diceRolled || gameState.dice.length === 0) return [];
        return getLegalTurns(gameState, gameState.turn, gameState.dice);
    }, [gameState]);

    const playableOrigins = useMemo(() => {
        if (mode === 'ai' && gameState.turn === P2) return new Set();
        return new Set(allValidTurns.map(t => t[0].from));
    }, [allValidTurns, mode, gameState.turn]);

    const checkWinCondition = useCallback((state) => {
        if (state.off[1] === 15 || state.off[2] === 15) {
            playWin();
            return true;
        }
        return false;
    }, [playWin]);

    const showNotif = (msg) => {
        setNotification(msg);
        setTimeout(() => setNotification(null), 2000);
    };

    const switchTurn = useCallback((stateOverride = null) => {
        setGameState(prev => {
            const nextState = stateOverride || prev;
            if (nextState.off[1] === 15 || nextState.off[2] === 15) return nextState;

            return {
                ...nextState,
                turn: nextState.turn === P1 ? P2 : P1,
                diceRolled: false,
                dice: [],
                originalDice: []
            };
        });
        setSelectedLoc(null);
        setValidTargets([]);
        setHistory([]);
    }, []);


    // --- AI LOGIC ---
    const processAITurn = useCallback(() => {
        if (gameState.turn !== P2 || checkWinCondition(gameState)) return;

        if (aiQueue.length > 0) {
            const move = aiQueue[0];
            setAiQueue(q => q.slice(1));
            executeMove(move);
            return;
        }

        if (allValidTurns.length === 0) {
            setTimeout(switchTurn, 1000);
            return;
        }

        let bestScore = -Infinity;
        let bestTurns = [];

        for (let turn of allValidTurns) {
            let tempState = cloneState(gameState);
            for (let move of turn) {
                tempState = applyMoveToState(tempState, move, P2);
            }
            let score = evaluateBoard(tempState, P2);
            let blotCount = tempState.board.filter(pt => pt.p === P2 && pt.c === 1).length;
            score -= blotCount * 30;

            if (score > bestScore) {
                bestScore = score;
                bestTurns = [turn];
            } else if (score === bestScore) {
                bestTurns.push(turn);
            }
        }

        const chosenTurn = bestTurns[Math.floor(Math.random() * bestTurns.length)];
        if (chosenTurn && chosenTurn.length > 0) {
            const [firstMove, ...restQueue] = chosenTurn;
            setAiQueue(restQueue);
            setTimeout(() => executeMove(firstMove), 600);
        }
    }, [gameState, allValidTurns, aiQueue, checkWinCondition, switchTurn]);

    
    // --- ACTIONS ---

    const rollDice = () => {
        if (gameState.diceRolled || isRolling) return;
        
        setIsRolling(true);
        playRoll();

        setTimeout(() => {
            const d1 = Math.floor(Math.random() * 6) + 1;
            const d2 = Math.floor(Math.random() * 6) + 1;
            
            let newDice = d1 === d2 ? [d1, d1, d1, d1] : [d1, d2];
            if (d1 === d2) showNotif("Doubles!");

            setGameState(prev => ({
                ...prev,
                dice: newDice,
                originalDice: [...newDice],
                diceRolled: true
            }));
            
            setHistory([]);
            setIsRolling(false);
        }, 400);
    };

    // Auto-roll for AI, or process empty turns
    useEffect(() => {
        if (checkWinCondition(gameState)) return;

        if (gameState.diceRolled) {
             if (allValidTurns.length === 0 && gameState.dice.length > 0) {
                 if(mode === 'pvp' || gameState.turn === P1) showNotif("No valid moves.");
                 aiTimeoutRef.current = setTimeout(switchTurn, 2000);
             } else if (mode === 'ai' && gameState.turn === P2) {
                 aiTimeoutRef.current = setTimeout(processAITurn, 800);
             }
        } else if (mode === 'ai' && gameState.turn === P2) {
             aiTimeoutRef.current = setTimeout(rollDice, 800);
        }

        return () => clearTimeout(aiTimeoutRef.current);
    }, [gameState.diceRolled, gameState.turn, allValidTurns.length, mode, processAITurn]);


    const executeMove = (moveData) => {
        setSelectedLoc(null);
        setValidTargets([]);

        // Save history for human moves
        if (mode === 'pvp' || gameState.turn === P1) {
            setHistory(prev => [...prev, cloneState(gameState)]);
        }

        let hitOccurred = false;
        if (moveData.to !== 'off') {
            let pt = gameState.board[moveData.to];
            if (pt.p !== 0 && pt.p !== gameState.turn && pt.c === 1) hitOccurred = true;
        }

        hitOccurred ? playHit() : playClick();

        setGameState(prev => {
            let ns = applyMoveToState(prev, moveData, prev.turn);
            let dieIdx = ns.dice.indexOf(moveData.die);
            if (dieIdx > -1) ns.dice.splice(dieIdx, 1);
            
            if (ns.dice.length === 0) {
                 setTimeout(() => switchTurn(ns), 800);
            }
            return ns;
        });
    };

    const handleLocationClick = (loc) => {
        if (!gameState.diceRolled || gameState.dice.length === 0) return;
        if (mode === 'ai' && gameState.turn === P2) return;

        // 1. Is it a bear-off click?
        if (loc === 'off1' || loc === 'off2') {
            if (selectedLoc !== null && loc === `off${gameState.turn}`) {
                let moveInfo = validTargets.find(t => t.to === 'off');
                if (moveInfo) executeMove(moveInfo.turnData);
            }
            return;
        }

        // 2. Is it a valid destination?
        if (selectedLoc !== null && typeof loc === 'number') {
            let moveInfo = validTargets.find(t => t.to === loc);
            if (moveInfo) {
                executeMove(moveInfo.turnData);
                return;
            }
        }

        // 3. Select Checker
        let searchLoc = loc;
        let isBarLoc = loc === 'bar1' || loc === 'bar2';
        
        if (isBarLoc) {
            if (loc !== `bar${gameState.turn}`) return;
            searchLoc = 'bar';
        }

        // Ensure we own the checker
        let ownsChecker = false;
        if (searchLoc === 'bar') {
            ownsChecker = gameState.bar[gameState.turn] > 0;
        } else {
            ownsChecker = gameState.board[loc].p === gameState.turn && gameState.board[loc].c > 0;
        }

        if (!ownsChecker) {
            setSelectedLoc(null);
            setValidTargets([]);
            return;
        }

        // Enforce bar rule
        if (gameState.bar[gameState.turn] > 0 && searchLoc !== 'bar') {
            showNotif("Must play from the bar first!");
            playError();
            setSelectedLoc(null);
            setValidTargets([]);
            return;
        }

        // Toggle selection
        if (selectedLoc === loc) {
            setSelectedLoc(null);
            setValidTargets([]);
            return;
        }

        playClick();
        setSelectedLoc(loc);

        // Calculate valid targets
        let targets = [];
        let logicOrigin = searchLoc;
        for (let turn of allValidTurns) {
            if (turn[0].from === logicOrigin) {
                if (!targets.some(t => t.to === turn[0].to)) {
                    targets.push({ to: turn[0].to, turnData: turn[0] });
                }
            }
        }
        setValidTargets(targets);
    };

    const handleUndo = () => {
        if (history.length === 0 || (mode === 'ai' && gameState.turn === P2)) return;
        setGameState(history[history.length - 1]);
        setHistory(prev => prev.slice(0, -1));
        setSelectedLoc(null);
        setValidTargets([]);
    };

    const handleRestart = () => {
        setGameState(createInitialState());
        setHistory([]);
        setAiQueue([]);
        setSelectedLoc(null);
        setValidTargets([]);
        setNotification(null);
    };


    // --- RENDER HELPERS ---
    
    const isGameOver = gameState.off[1] === 15 || gameState.off[2] === 15;

    const renderDice = () => {
        const d1Val = gameState.originalDice[0] || 1;
        const d2Val = gameState.originalDice.length > 1 ? gameState.originalDice[1] : 2;
        
        const orig = gameState.originalDice;
        const curr = gameState.dice;
        
        let d1Used = true, d2Used = true;
        
        if (gameState.diceRolled) {
            if (orig.length === 4) { // Doubles
                let used = 4 - curr.length;
                d1Used = used >= 2;
                d2Used = used >= 4;
            } else {
                d1Used = !curr.includes(d1Val) || curr.length === 0;
                let countInOrig = orig.filter(x => x === d2Val).length;
                let countInCurr = curr.filter(x => x === d2Val).length;
                d2Used = (countInCurr < countInOrig && d1Val !== d2Val) || curr.length === 0 || !curr.includes(d2Val);
            }
        }

        const Dot = () => <div className="dot"></div>;
        return (
            <div className="dice-container">
                <button className="btn" onClick={handleUndo} disabled={history.length === 0 || (mode === 'ai' && gameState.turn === P2)}>Undo</button>
                <div className={`die ${isRolling ? 'rolling' : ''} ${d1Used ? 'used' : ''}`} data-val={d1Val}>
                    <Dot/><Dot/><Dot/><Dot/><Dot/><Dot/><Dot/><Dot/><Dot/>
                </div>
                <div className={`die ${isRolling ? 'rolling' : ''} ${d2Used ? 'used' : ''}`} data-val={d2Val}>
                    <Dot/><Dot/><Dot/><Dot/><Dot/><Dot/><Dot/><Dot/><Dot/>
                </div>
                <button className="btn" onClick={rollDice} disabled={gameState.diceRolled || isRolling || (mode==='ai' && gameState.turn === P2)}>Roll</button>
            </div>
        );
    };

    const renderBar = (player) => {
        const count = gameState.bar[player];
        const isHighlighted = validTargets.some(t => t.to === `bar${player}`); // Never really valid to move TO opponent bar, but keeps logic symmetrical
        const isSelected = selectedLoc === `bar${player}`;
        const isPlayable = playableOrigins.has('bar') && gameState.turn === player && count > 0;

        let checkers = [];
        for(let i=0; i<count; i++) {
            let isTop = i === count - 1;
            checkers.push(
                <Checker 
                    key={`bar${player}-${i}`} 
                    player={player} 
                    isTop={isTop}
                    count={count}
                    isPlayable={isTop && isPlayable && !isSelected}
                    isSelected={isTop && isSelected}
                />
            );
        }

        return (
            <div className={`bar-slot ${isHighlighted ? 'highlight' : ''}`} onClick={() => handleLocationClick(`bar${player}`)}>
                <div className="checkers-container align-center">
                    {checkers}
                </div>
            </div>
        );
    }


    return (
        <>
            <style>{`
                :root {
                    --wood-bg: #1a100c; 
                    --wood-board-base: #98653b;
                    --point-dark: #222222;
                    --point-light: #e4c59a;
                    --checker-p1: #ebdcb9;
                    --checker-p2: #181818;
                    --highlight: rgba(100, 255, 100, 0.4);
                    --selected: rgba(255, 215, 0, 0.8);
                    --playable: rgba(100, 200, 255, 0.5);
                    --board-width: min(95vw, 1000px);
                    --board-height: min(70vh, 700px);
                    --checker-size: calc(var(--board-height) * 0.088); 
                }
                * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; }
                body {
                    background-color: var(--wood-bg);
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    color: #ebdcb9; display: flex; flex-direction: column; align-items: center; justify-content: center;
                    min-height: 100vh; overflow: hidden;
                    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.04'/%3E%3C/svg%3E"), radial-gradient(circle at center, #2e1d15 0%, #110906 100%);
                }
                .header { width: var(--board-width); display: flex; justify-content: space-between; align-items: center; padding: 12px 25px; background: linear-gradient(to bottom, #3d2314, #241208); border-radius: 8px 8px 0 0; border: 2px solid #5a351d; border-bottom: none; box-shadow: 0 -5px 20px rgba(0,0,0,0.8); margin-bottom: -2px; z-index: 10; position: relative; }
                .score-board { display: flex; gap: 30px; font-size: 1.1rem; font-weight: bold; }
                .score-box { display: flex; align-items: center; gap: 10px; padding: 5px 12px; background: rgba(0,0,0,0.5); border-radius: 6px; border: 1px solid rgba(255,255,255,0.05); box-shadow: inset 0 2px 4px rgba(0,0,0,0.6); }
                .score-box .dot { width: 16px; height: 16px; border-radius: 50%; box-shadow: inset 0 -2px 3px rgba(0,0,0,0.6), 0 1px 3px rgba(0,0,0,0.8); }
                .turn-indicator { font-size: 1.5rem; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; color: #e4c59a; text-shadow: 0 2px 4px rgba(0,0,0,0.8); transition: color 0.3s; }
                .game-area { display: flex; gap: 15px; align-items: stretch; position: relative; box-shadow: 0 25px 50px rgba(0,0,0,0.9); border-radius: 8px; z-index: 5; }
                .board-wrapper { position: relative; width: var(--board-width); height: var(--board-height); background-color: var(--wood-board-base); background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.4' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.08'/%3E%3C/svg%3E"), repeating-linear-gradient(90deg, transparent 0, transparent 40px, rgba(0,0,0,0.03) 40px, rgba(0,0,0,0.03) 80px), linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(0,0,0,0.3) 100%); border-color: #5c3522 #2e160b #1a0b05 #4a2918; border-style: solid; border-width: 25px; border-radius: 10px; box-shadow: inset 0 0 40px rgba(0,0,0,0.8), inset 0 0 10px rgba(0,0,0,0.5), 0 15px 35px rgba(0,0,0,0.6); display: flex; }
                .board-half { flex: 1; display: grid; grid-template-columns: repeat(6, 1fr); grid-template-rows: 50% 50%; position: relative; box-shadow: inset 0 0 25px rgba(0,0,0,0.4); }
                .bar { width: 50px; background: #4a2d1a; border-left: 3px solid #2b180d; border-right: 3px solid #2b180d; box-shadow: inset 0 0 15px rgba(0,0,0,0.8), 0 0 15px rgba(0,0,0,0.6); display: flex; flex-direction: column; z-index: 10; position: relative; }
                .bar-slot { flex: 1; position: relative; display: flex; justify-content: center; }
                .bar::before, .bar::after { content: ''; position: absolute; width: 90%; height: 35px; background-image: radial-gradient(circle at 15% 50%, #221504 2px, transparent 2.5px), radial-gradient(circle at 85% 50%, #221504 2px, transparent 2.5px), linear-gradient(90deg, #5c4314 0%, #a88732 20%, #d4b557 50%, #a88732 80%, #5c4314 100%); border-top: 1px solid rgba(255,255,255,0.4); border-bottom: 1px solid rgba(0,0,0,0.8); box-shadow: 0 4px 8px rgba(0,0,0,0.7), inset 0 1px 2px rgba(255,255,255,0.4); border-radius: 3px; z-index:2; left: 5%; }
                .bar::before { top: 15%; } .bar::after { bottom: 15%; }
                .point { position: relative; display: flex; justify-content: center; cursor: pointer; }
                .point::before { content: ''; position: absolute; width: 100%; height: 90%; transition: all 0.2s; filter: drop-shadow(1px 2px 2px rgba(0,0,0,0.3)); z-index: 0; }
                .top-row.point::before { top: 0; clip-path: polygon(0 0, 100% 0, 50% 100%); }
                .bottom-row.point::before { bottom: 0; clip-path: polygon(50% 0, 0 100%, 100% 100%); }
                .point:nth-child(even)::before { background-color: var(--point-dark); }
                .point:nth-child(odd)::before { background-color: var(--point-light); }
                .board-half:nth-child(3) .point:nth-child(even)::before { background-color: var(--point-light); }
                .board-half:nth-child(3) .point:nth-child(odd)::before { background-color: var(--point-dark); }
                .point.highlight::after, .bar-slot.highlight::after, .home-slot.highlight::after { content: ''; position: absolute; background: var(--highlight); pointer-events: none; z-index: 5; animation: pulseGlow 1.2s infinite alternate; }
                .top-row.highlight::after { top: 0; left: 0; right: 0; height: 90%; clip-path: polygon(0 0, 100% 0, 50% 100%); }
                .bottom-row.highlight::after { bottom: 0; left: 0; right: 0; height: 90%; clip-path: polygon(50% 0, 0 100%, 100% 100%); }
                .home-slot.highlight::after { top: 0; left: 0; right: 0; bottom: 0; border-radius: 4px; }
                @keyframes pulseGlow { from { opacity: 0.3; box-shadow: 0 0 10px var(--highlight); } to { opacity: 0.7; box-shadow: 0 0 20px var(--highlight); } }
                .homes { width: 80px; background: #2b180d; border: 20px solid #4a2d1a; border-left: 5px solid #1a0f08; border-radius: 0 6px 6px 0; display: flex; flex-direction: column; box-shadow: inset 0 0 30px rgba(0,0,0,0.9); }
                .home-slot { flex: 1; border-bottom: 3px solid #150a04; position: relative; display: flex; align-items: center; justify-content: center; cursor: pointer; overflow: hidden; transition: background 0.2s; }
                .home-slot:hover { background: rgba(255,255,255,0.05); } .home-slot:last-child { border-bottom: none; }
                .off-count { position: absolute; font-size: 2.5rem; font-weight: bold; color: rgba(255,255,255,0.15); z-index: 1; }
                
                /* REACT CHECKER POSITIONING */
                .checkers-container { position: absolute; width: 100%; height: 90%; display: flex; flex-direction: column; align-items: center; z-index: 10; }
                .checkers-container.align-top { top: 0; justify-content: flex-start; }
                .checkers-container.align-bottom { bottom: 0; justify-content: flex-end; }
                .checkers-container.align-center { height: 100%; justify-content: center; }

                /* Negative margin logic for overlapping inside flex */
                .checker { width: var(--checker-size); height: var(--checker-size); min-height: var(--checker-size); border-radius: 50%; box-shadow: 2px 5px 8px rgba(0,0,0,0.6), inset 0 2px 4px rgba(255,255,255,0.4), inset 0 -3px 5px rgba(0,0,0,0.5); transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s; display: flex; align-items: center; justify-content: center; position: relative; }
                .checkers-container > .checker:not(:first-child) { margin-top: -15%; }
                
                /* Extreme stacking overlap (more than 5) via CSS child targeting */
                .checkers-container > .checker:nth-child(n+6) { margin-top: -50%; } 

                .checker::after { content: ''; position: absolute; top: 4%; left: 10%; width: 80%; height: 35%; background: linear-gradient(to bottom, rgba(255,255,255,0.15), transparent); border-radius: 50% 50% 0 0; pointer-events: none; }
                .checker.p1 { background-color: var(--checker-p1); background-image: repeating-radial-gradient(circle at center, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 8%, rgba(120, 75, 30, 0.4) 10%, rgba(255, 255, 255, 0.5) 12%, rgba(0,0,0,0) 14%); border: 2px solid #a38962; }
                .checker.p2 { background-color: var(--checker-p2); background-image: repeating-radial-gradient(circle at center, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 8%, rgba(0, 0, 0, 0.95) 10%, rgba(255, 255, 255, 0.2) 12%, rgba(0,0,0,0) 14%); border: 2px solid #000; }
                .checker.playable { animation: playablePulse 2s infinite; cursor: pointer; }
                @keyframes playablePulse { 0% { box-shadow: 2px 5px 8px rgba(0,0,0,0.6), inset 0 2px 4px rgba(255,255,255,0.4), inset 0 -3px 5px rgba(0,0,0,0.5), 0 0 0 0 var(--playable); } 50% { box-shadow: 2px 5px 8px rgba(0,0,0,0.6), inset 0 2px 4px rgba(255,255,255,0.4), inset 0 -3px 5px rgba(0,0,0,0.5), 0 0 12px 6px var(--playable); } 100% { box-shadow: 2px 5px 8px rgba(0,0,0,0.6), inset 0 2px 4px rgba(255,255,255,0.4), inset 0 -3px 5px rgba(0,0,0,0.5), 0 0 0 0 var(--playable); } }
                .checker.selected { box-shadow: 0 15px 25px rgba(0,0,0,0.8), inset 0 2px 4px rgba(255,255,255,0.4), inset 0 -3px 5px rgba(0,0,0,0.5), 0 0 15px 5px var(--selected) !important; transform: scale(1.05); }
                .checker .badge { position: absolute; top: -4px; right: -4px; background: #2b180d; color: #ebdcb9; border-radius: 50%; width: 20px; height: 20px; font-size: 12px; font-weight: bold; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.9); border: 1px solid #ebdcb9; z-index: 10; }
                
                .controls { width: var(--board-width); background: rgba(30, 18, 10, 0.8); padding: 15px 25px; margin-top: 15px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; border: 1px solid #4a2d1a; box-shadow: 0 5px 15px rgba(0,0,0,0.5); }
                .dice-container { display: flex; gap: 20px; align-items: center; }
                .die { width: 56px; height: 56px; background-color: #fffff4; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.5' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.05'/%3E%3C/svg%3E"), radial-gradient(circle at 30% 30%, #ffffff, #e3dac9); border-radius: 10px; box-shadow: inset -2px -2px 8px rgba(0,0,0,0.3), inset 2px 2px 8px rgba(255,255,255,1), 0 6px 12px rgba(0,0,0,0.6); display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(3, 1fr); padding: 8px; gap: 3px; transition: transform 0.4s ease-out, opacity 0.3s; border: 1px solid #a89980; }
                .die.rolling { animation: rollDie 0.4s linear infinite; }
                @keyframes rollDie { 0% { transform: rotate(0deg) scale(1) translateY(0); } 25% { transform: rotate(90deg) scale(1.1) translateY(-10px); } 50% { transform: rotate(180deg) scale(1) translateY(0); } 75% { transform: rotate(270deg) scale(1.1) translateY(-10px); } 100% { transform: rotate(360deg) scale(1) translateY(0); } }
                .dot { background: #111; border-radius: 50%; width: 12px; height: 12px; place-self: center; visibility: hidden; box-shadow: inset 0 2px 4px rgba(0,0,0,0.8), 0 1px 1px rgba(255,255,255,0.5); }
                .die[data-val="1"] .dot:nth-child(5) { visibility: visible; }
                .die[data-val="2"] .dot:nth-child(3), .die[data-val="2"] .dot:nth-child(7) { visibility: visible; }
                .die[data-val="3"] .dot:nth-child(3), .die[data-val="3"] .dot:nth-child(5), .die[data-val="3"] .dot:nth-child(7) { visibility: visible; }
                .die[data-val="4"] .dot:nth-child(1), .die[data-val="4"] .dot:nth-child(3), .die[data-val="4"] .dot:nth-child(7), .die[data-val="4"] .dot:nth-child(9) { visibility: visible; }
                .die[data-val="5"] .dot:nth-child(1), .die[data-val="5"] .dot:nth-child(3), .die[data-val="5"] .dot:nth-child(5), .die[data-val="5"] .dot:nth-child(7), .die[data-val="5"] .dot:nth-child(9) { visibility: visible; }
                .die[data-val="6"] .dot:nth-child(1), .die[data-val="6"] .dot:nth-child(3), .die[data-val="6"] .dot:nth-child(4), .die[data-val="6"] .dot:nth-child(6), .die[data-val="6"] .dot:nth-child(7), .die[data-val="6"] .dot:nth-child(9) { visibility: visible; }
                .die.used { opacity: 0.3; transform: scale(0.9); box-shadow: 0 2px 4px rgba(0,0,0,0.4); }
                .btn { padding: 10px 20px; font-size: 1rem; font-weight: bold; color: #ebdcb9; background: #3d2314; border: 1px solid #5a351d; border-radius: 6px; cursor: pointer; box-shadow: 0 4px 8px rgba(0,0,0,0.5); text-transform: uppercase; letter-spacing: 1px; transition: all 0.15s ease; }
                .btn:hover:not(:disabled) { background: #4a2d1a; transform: translateY(-1px); }
                .btn:active:not(:disabled) { transform: translateY(1px); box-shadow: 0 1px 2px rgba(0,0,0,0.6); }
                .btn:disabled { background: #1a0f08; border-color: #110905; color: #555; cursor: not-allowed; box-shadow: none; }
                .controls-group { display: flex; gap: 12px; align-items: center; }
                select { padding: 10px; font-size: 1rem; background: #1a0f08; color: #ebdcb9; border: 1px solid #5a351d; border-radius: 6px; cursor: pointer; outline: none; }
                .modal { display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); z-index: 1000; justify-content: center; align-items: center; flex-direction: column; backdrop-filter: blur(4px); }
                .modal-content { background: linear-gradient(to bottom, #3d2314, #1a0f08); border: 4px solid #ebdcb9; padding: 40px; border-radius: 10px; text-align: center; box-shadow: 0 0 50px rgba(0,0,0,0.8); animation: slideIn 0.4s ease-out; }
                @keyframes slideIn { from { transform: translateY(-50px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                .modal h1 { font-size: 3rem; margin-bottom: 20px; color: #ebdcb9; text-shadow: 0 2px 4px rgba(0,0,0,0.8); }
                .modal p { font-size: 1.5rem; margin-bottom: 30px; color: #ccc; }
                .notification { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(30, 18, 10, 0.95); color: #ebdcb9; padding: 20px 40px; border-radius: 8px; border: 2px solid #5a351d; font-size: 1.5rem; font-weight: bold; pointer-events: none; opacity: 0; transition: opacity 0.3s; z-index: 50; box-shadow: 0 10px 25px rgba(0,0,0,0.8); text-align: center; text-transform: uppercase; }
                .show-notif { opacity: 1; }
                @media (max-width: 900px) { .board-wrapper { height: 60vh; border-width: 12px; } .bar { width: 40px; } .homes { width: 60px; border-width: 12px; } .turn-indicator { font-size: 1.2rem; } .btn { padding: 8px 15px; font-size: 0.9rem; } .score-board { gap: 15px; font-size: 1rem; } .controls { flex-direction: column; gap: 15px; } }
                @media (max-width: 500px) { .controls-group, .dice-container { flex-wrap: wrap; justify-content: center; } .header { flex-direction: column; gap: 10px; } }
            `}</style>

            <div className="header">
                <div className="score-board">
                    <div className="score-box" style={{ color: 'var(--checker-p1)' }}>
                        <div className="dot" style={{ background: 'var(--checker-p1)' }}></div>
                        P1 (White) Off: <span>{gameState.off[1]}</span>
                    </div>
                    <div className="score-box" style={{ color: '#bbb' }}>
                        <div className="dot" style={{ background: 'var(--checker-p2)' }}></div>
                        P2 (Black) Off: <span>{gameState.off[2]}</span>
                    </div>
                </div>
                <div className="turn-indicator" style={{ color: gameState.turn === P1 ? '#e4c59a' : '#aaa' }}>
                    {gameState.turn === P1 ? "Player 1 (White)'s Turn" : "Player 2 (Black)'s Turn"}
                </div>
            </div>

            <div className="game-area">
                <div className="board-wrapper">
                    <div className="board-half left-board">
                        {[12, 13, 14, 15, 16, 17].map(idx => (
                            <Point key={idx} idx={idx} rowType="top-row" ptData={gameState.board[idx]} onClick={handleLocationClick} 
                                   isHighlighted={validTargets.some(t => t.to === idx)} playablePlayer={playableOrigins.has(idx) ? gameState.turn : null} isSelectedId={selectedLoc} />
                        ))}
                        {[11, 10, 9, 8, 7, 6].map(idx => (
                            <Point key={idx} idx={idx} rowType="bottom-row" ptData={gameState.board[idx]} onClick={handleLocationClick} 
                                   isHighlighted={validTargets.some(t => t.to === idx)} playablePlayer={playableOrigins.has(idx) ? gameState.turn : null} isSelectedId={selectedLoc} />
                        ))}
                    </div>

                    <div className="bar">
                        {renderBar(P1)}
                        {renderBar(P2)}
                    </div>

                    <div className="board-half right-board">
                        {[18, 19, 20, 21, 22, 23].map(idx => (
                            <Point key={idx} idx={idx} rowType="top-row" ptData={gameState.board[idx]} onClick={handleLocationClick} 
                                   isHighlighted={validTargets.some(t => t.to === idx)} playablePlayer={playableOrigins.has(idx) ? gameState.turn : null} isSelectedId={selectedLoc} />
                        ))}
                        {[5, 4, 3, 2, 1, 0].map(idx => (
                            <Point key={idx} idx={idx} rowType="bottom-row" ptData={gameState.board[idx]} onClick={handleLocationClick} 
                                   isHighlighted={validTargets.some(t => t.to === idx)} playablePlayer={playableOrigins.has(idx) ? gameState.turn : null} isSelectedId={selectedLoc} />
                        ))}
                    </div>
                </div>

                <div className="homes">
                    <div className={`home-slot ${validTargets.some(t => t.to === 'off' && gameState.turn === P2) ? 'highlight' : ''}`} onClick={() => handleLocationClick('off2')}>
                        <div className="off-count">{gameState.off[2]}</div>
                    </div>
                    <div className={`home-slot ${validTargets.some(t => t.to === 'off' && gameState.turn === P1) ? 'highlight' : ''}`} onClick={() => handleLocationClick('off1')}>
                        <div className="off-count">{gameState.off[1]}</div>
                    </div>
                </div>
            </div>

            <div className="controls">
                <div className="controls-group">
                    <select value={mode} onChange={(e) => { setMode(e.target.value); handleRestart(); }}>
                        <option value="pvp">P to P (Player vs Player)</option>
                        <option value="ai">P to AI (Player vs Computer)</option>
                    </select>
                    <button className="btn" onClick={handleRestart}>Restart</button>
                    <button className="btn" onClick={() => setSoundEnabled(!soundEnabled)}>Sound: {soundEnabled ? 'ON' : 'OFF'}</button>
                </div>
                {renderDice()}
            </div>

            {isGameOver && (
                <div className="modal">
                    <div className="modal-content">
                        <h1>{gameState.off[1] === 15 ? "Player 1 (White)" : "Player 2 (Black)"} Wins!</h1>
                        <p>Final Pips - P1: {getPipCount(gameState, P1)} | P2: {getPipCount(gameState, P2)}</p>
                        <button className="btn" onClick={handleRestart}>Play Again</button>
                    </div>
                </div>
            )}

            <div className={`notification ${notification ? 'show-notif' : ''}`}>{notification}</div>
        </>
    );
};

export default App;
