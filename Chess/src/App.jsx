// By Manthan Vinzuda
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { RefreshCw, Trophy, AlertTriangle, User, Settings, Flag, Cpu, Activity } from 'lucide-react';

// --- CHESS ENGINE CONSTANTS & PIECE-SQUARE TABLES ---

const PIECE_VALUES = { p: 10, n: 30, b: 30, r: 50, q: 90, k: 900 };

const INITIAL_BOARD = [
  ['br', 'bn', 'bb', 'bq', 'bk', 'bb', 'bn', 'br'],
  ['bp', 'bp', 'bp', 'bp', 'bp', 'bp', 'bp', 'bp'],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  ['wp', 'wp', 'wp', 'wp', 'wp', 'wp', 'wp', 'wp'],
  ['wr', 'wn', 'wb', 'wq', 'wk', 'wb', 'wn', 'wr'],
];

const PIECE_IMAGES = {
  wp: 'https://upload.wikimedia.org/wikipedia/commons/4/45/Chess_plt45.svg',
  wn: 'https://upload.wikimedia.org/wikipedia/commons/7/70/Chess_nlt45.svg',
  wb: 'https://upload.wikimedia.org/wikipedia/commons/b/b1/Chess_blt45.svg',
  wr: 'https://upload.wikimedia.org/wikipedia/commons/7/72/Chess_rlt45.svg',
  wq: 'https://upload.wikimedia.org/wikipedia/commons/1/15/Chess_qlt45.svg',
  wk: 'https://upload.wikimedia.org/wikipedia/commons/4/42/Chess_klt45.svg',
  bp: 'https://upload.wikimedia.org/wikipedia/commons/c/c7/Chess_pdt45.svg',
  bn: 'https://upload.wikimedia.org/wikipedia/commons/e/ef/Chess_ndt45.svg',
  bb: 'https://upload.wikimedia.org/wikipedia/commons/9/98/Chess_bdt45.svg',
  br: 'https://upload.wikimedia.org/wikipedia/commons/f/ff/Chess_rdt45.svg',
  bq: 'https://upload.wikimedia.org/wikipedia/commons/4/47/Chess_qdt45.svg',
  bk: 'https://upload.wikimedia.org/wikipedia/commons/f/f0/Chess_kdt45.svg'
};

// Positional bonuses (Piece-Square Tables) for AI to play positionally, not just materially.
// Central control is rewarded.
const PST = {
  p: [
    [0,  0,  0,  0,  0,  0,  0,  0],
    [5, 10, 10,-20,-20, 10, 10,  5],
    [5, -5,-10,  0,  0,-10, -5,  5],
    [0,  0,  0, 20, 20,  0,  0,  0],
    [5,  5, 10, 25, 25, 10,  5,  5],
    [10, 10, 20, 30, 30, 20, 10, 10],
    [50, 50, 50, 50, 50, 50, 50, 50],
    [0,  0,  0,  0,  0,  0,  0,  0]
  ],
  n: [
    [-50,-40,-30,-30,-30,-30,-40,-50],
    [-40,-20,  0,  5,  5,  0,-20,-40],
    [-30,  5, 10, 15, 15, 10,  5,-30],
    [-30,  0, 15, 20, 20, 15,  0,-30],
    [-30,  5, 15, 20, 20, 15,  5,-30],
    [-30,  0, 10, 15, 15, 10,  0,-30],
    [-40,-20,  0,  0,  0,  0,-20,-40],
    [-50,-40,-30,-30,-30,-30,-40,-50]
  ]
};

// --- CORE ENGINE LOGIC ---

const cloneBoard = (board) => board.map(row => [...row]);
const isValid = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;

const isSquareAttacked = (r, c, board, attackerColor) => {
  if (r === -1 || c === -1) return false;
  const enemyRook = attackerColor + 'r', enemyBishop = attackerColor + 'b', enemyQueen = attackerColor + 'q';
  const enemyKnight = attackerColor + 'n', enemyKing = attackerColor + 'k', enemyPawn = attackerColor + 'p';

  const straights = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (let [dr, dc] of straights) {
    let nr = r + dr, nc = c + dc;
    while (isValid(nr, nc)) {
      const piece = board[nr][nc];
      if (piece) { if (piece === enemyRook || piece === enemyQueen) return true; break; }
      nr += dr; nc += dc;
    }
  }

  const diagonals = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  for (let [dr, dc] of diagonals) {
    let nr = r + dr, nc = c + dc;
    while (isValid(nr, nc)) {
      const piece = board[nr][nc];
      if (piece) { if (piece === enemyBishop || piece === enemyQueen) return true; break; }
      nr += dr; nc += dc;
    }
  }

  const knightMoves = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  for (let [dr, dc] of knightMoves) {
    const nr = r + dr, nc = c + dc;
    if (isValid(nr, nc) && board[nr][nc] === enemyKnight) return true;
  }

  const pawnDir = attackerColor === 'w' ? 1 : -1;
  const pawnCaptures = [[pawnDir, -1], [pawnDir, 1]];
  for (let [dr, dc] of pawnCaptures) {
    const nr = r + dr, nc = c + dc;
    if (isValid(nr, nc) && board[nr][nc] === enemyPawn) return true;
  }

  const kingMoves = [...straights, ...diagonals];
  for (let [dr, dc] of kingMoves) {
    const nr = r + dr, nc = c + dc;
    if (isValid(nr, nc) && board[nr][nc] === enemyKing) return true;
  }
  return false;
};

const getPseudoLegalMoves = (r, c, board, castlingRights, enPassantTarget) => {
  const piece = board[r][c];
  if (!piece) return [];
  const color = piece[0], type = piece[1];
  const moves = [];
  const addMove = (nr, nc) => moves.push({ r: nr, c: nc });
  const isEnemy = (nr, nc) => board[nr][nc] && board[nr][nc][0] !== color;
  const isEmpty = (nr, nc) => !board[nr][nc];

  const slide = (directions) => {
    for (let [dr, dc] of directions) {
      let nr = r + dr, nc = c + dc;
      while (isValid(nr, nc)) {
        if (isEmpty(nr, nc)) addMove(nr, nc);
        else { if (isEnemy(nr, nc)) addMove(nr, nc); break; }
        nr += dr; nc += dc;
      }
    }
  };

  if (type === 'p') {
    const dir = color === 'w' ? -1 : 1;
    const startRow = color === 'w' ? 6 : 1;
    if (isValid(r + dir, c) && isEmpty(r + dir, c)) {
      addMove(r + dir, c);
      if (r === startRow && isEmpty(r + dir * 2, c)) addMove(r + dir * 2, c);
    }
    for (let dc of [-1, 1]) {
      if (isValid(r + dir, c + dc)) {
        if (isEnemy(r + dir, c + dc)) addMove(r + dir, c + dc);
        if (enPassantTarget && enPassantTarget.r === r + dir && enPassantTarget.c === c + dc) addMove(r + dir, c + dc);
      }
    }
  } else if (type === 'n') {
    const knightMoves = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
    for (let [dr, dc] of knightMoves) {
      const nr = r + dr, nc = c + dc;
      if (isValid(nr, nc) && (isEmpty(nr, nc) || isEnemy(nr, nc))) addMove(nr, nc);
    }
  } else if (type === 'b') slide([[-1, -1], [-1, 1], [1, -1], [1, 1]]);
  else if (type === 'r') slide([[-1, 0], [1, 0], [0, -1], [0, 1]]);
  else if (type === 'q') slide([[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]]);
  else if (type === 'k') {
    const kingMoves = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];
    for (let [dr, dc] of kingMoves) {
      const nr = r + dr, nc = c + dc;
      if (isValid(nr, nc) && (isEmpty(nr, nc) || isEnemy(nr, nc))) addMove(nr, nc);
    }
    if (castlingRights) {
      const enemyColor = color === 'w' ? 'b' : 'w';
      if (color === 'w') {
        if (castlingRights.wK && isEmpty(7, 5) && isEmpty(7, 6) && !isSquareAttacked(7, 4, board, enemyColor) && !isSquareAttacked(7, 5, board, enemyColor)) addMove(7, 6);
        if (castlingRights.wQ && isEmpty(7, 1) && isEmpty(7, 2) && isEmpty(7, 3) && !isSquareAttacked(7, 4, board, enemyColor) && !isSquareAttacked(7, 3, board, enemyColor)) addMove(7, 2);
      } else {
        if (castlingRights.bK && isEmpty(0, 5) && isEmpty(0, 6) && !isSquareAttacked(0, 4, board, enemyColor) && !isSquareAttacked(0, 5, board, enemyColor)) addMove(0, 6);
        if (castlingRights.bQ && isEmpty(0, 1) && isEmpty(0, 2) && isEmpty(0, 3) && !isSquareAttacked(0, 4, board, enemyColor) && !isSquareAttacked(0, 3, board, enemyColor)) addMove(0, 2);
      }
    }
  }
  return moves;
};

const getLegalMoves = (r, c, board, castlingRights, enPassantTarget) => {
  const piece = board[r][c];
  if (!piece) return [];
  const color = piece[0];
  const enemyColor = color === 'w' ? 'b' : 'w';
  const pseudoMoves = getPseudoLegalMoves(r, c, board, castlingRights, enPassantTarget);
  const legalMoves = [];

  for (const move of pseudoMoves) {
    const tempBoard = cloneBoard(board);
    tempBoard[move.r][move.c] = tempBoard[r][c];
    tempBoard[r][c] = null;
    
    // Handle en passant capture in simulation
    if (piece[1] === 'p' && enPassantTarget && move.r === enPassantTarget.r && move.c === enPassantTarget.c) {
      tempBoard[color === 'w' ? move.r + 1 : move.r - 1][move.c] = null;
    }

    let kingR = -1, kingC = -1;
    for (let ir = 0; ir < 8; ir++) {
      for (let ic = 0; ic < 8; ic++) {
        if (tempBoard[ir][ic] === color + 'k') { kingR = ir; kingC = ic; break; }
      }
      if (kingR !== -1) break;
    }
    
    if (kingR !== -1 && !isSquareAttacked(kingR, kingC, tempBoard, enemyColor)) {
      legalMoves.push(move);
    }
  }
  return legalMoves;
};

// Returns a new state without mutating original
const simulateMove = (board, fromR, fromC, toR, toC, castling, ep) => {
  const newBoard = cloneBoard(board);
  const piece = newBoard[fromR][fromC];
  let nextEP = null;
  let newCR = { ...castling };

  // En Passant
  if (piece[1] === 'p' && ep && toR === ep.r && toC === ep.c) newBoard[fromR][toC] = null;
  if (piece[1] === 'p' && Math.abs(toR - fromR) === 2) nextEP = { r: (fromR + toR) / 2, c: toC };
  
  // Castling
  if (piece[1] === 'k' && Math.abs(toC - fromC) === 2) {
    if (toC === 6) { newBoard[fromR][5] = newBoard[fromR][7]; newBoard[fromR][7] = null; }
    else { newBoard[fromR][3] = newBoard[fromR][0]; newBoard[fromR][0] = null; }
  }

  // Update Castling Rights
  if (piece === 'wk') { newCR.wK = false; newCR.wQ = false; }
  if (piece === 'bk') { newCR.bK = false; newCR.bQ = false; }
  if (piece === 'wr' && fromC === 7) newCR.wK = false;
  if (piece === 'wr' && fromC === 0) newCR.wQ = false;
  if (piece === 'br' && fromC === 7) newCR.bK = false;
  if (piece === 'br' && fromC === 0) newCR.bQ = false;
  if (toR === 7 && toC === 7) newCR.wK = false;
  if (toR === 7 && toC === 0) newCR.wQ = false;
  if (toR === 0 && toC === 7) newCR.bK = false;
  if (toR === 0 && toC === 0) newCR.bQ = false;

  newBoard[toR][toC] = piece;
  newBoard[fromR][fromC] = null;

  // Auto Queen Promotion
  if (piece[1] === 'p' && (toR === 0 || toR === 7)) newBoard[toR][toC] = piece[0] + 'q';

  return { newBoard, newCR, nextEP };
};

const evaluateBoardState = (board) => {
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece) {
        const color = piece[0], type = piece[1];
        let val = PIECE_VALUES[type] || 0;
        
        // Add Positional Bonus
        if (PST[type]) {
          const pstRow = color === 'w' ? r : 7 - r; 
          val += (PST[type][pstRow][c] / 10);
        }

        if (color === 'w') score += val; 
        else score -= val;
      }
    }
  }
  return score;
};

// --- GRANDMASTER AI (Minimax with simple Alpha-Beta Pruning) ---

const getAIMove = (board, turn, castling, ep, depth = 2) => {
  const getAllMoves = (currentBoard, color, cr, currentEp) => {
    let moves = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (currentBoard[r][c]?.startsWith(color)) {
          const pieceMoves = getLegalMoves(r, c, currentBoard, cr, currentEp);
          pieceMoves.forEach(to => moves.push({ from: { r, c }, to }));
        }
      }
    }
    return moves.sort(() => Math.random() - 0.5); // Add slight randomness
  };

  const minimax = (currBoard, currDepth, alpha, beta, isMaximizing, currCR, currEP) => {
    if (currDepth === 0) return evaluateBoardState(currBoard);
    const moves = getAllMoves(currBoard, isMaximizing ? 'w' : 'b', currCR, currEP);
    if (moves.length === 0) return isMaximizing ? -9999 : 9999; // Checkmate bias

    if (isMaximizing) {
      let maxEval = -Infinity;
      for (let move of moves) {
        const { newBoard, newCR, nextEP } = simulateMove(currBoard, move.from.r, move.from.c, move.to.r, move.to.c, currCR, currEP);
        const ev = minimax(newBoard, currDepth - 1, alpha, beta, false, newCR, nextEP);
        maxEval = Math.max(maxEval, ev);
        alpha = Math.max(alpha, ev);
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (let move of moves) {
        const { newBoard, newCR, nextEP } = simulateMove(currBoard, move.from.r, move.from.c, move.to.r, move.to.c, currCR, currEP);
        const ev = minimax(newBoard, currDepth - 1, alpha, beta, true, newCR, nextEP);
        minEval = Math.min(minEval, ev);
        beta = Math.min(beta, ev);
        if (beta <= alpha) break;
      }
      return minEval;
    }
  };

  const validMoves = getAllMoves(board, turn, castling, ep);
  if (validMoves.length === 0) return null;

  let bestMove = null;
  let bestValue = turn === 'w' ? -Infinity : Infinity;

  for (let move of validMoves) {
    const { newBoard, newCR, nextEP } = simulateMove(board, move.from.r, move.from.c, move.to.r, move.to.c, castling, ep);
    const boardValue = minimax(newBoard, depth - 1, -Infinity, Infinity, turn === 'b', newCR, nextEP); // Flip isMaximizing based on next turn
    
    if (turn === 'w') {
      if (boardValue > bestValue) { bestValue = boardValue; bestMove = move; }
    } else {
      if (boardValue < bestValue) { bestValue = boardValue; bestMove = move; }
    }
  }
  return bestMove || validMoves[0]; // Fallback to random valid move
};

// --- REACT COMPONENTS ---

const PlayerInfo = ({ name, color, rating, isTurn, captured, advantage, isThinking, icon: Icon }) => (
  <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center w-full py-3 px-5 rounded-2xl transition-all duration-300 ${isTurn ? 'bg-slate-800 border border-indigo-500/50 shadow-lg shadow-indigo-500/10' : 'bg-slate-900/50 border border-slate-800'}`}>
    <div className="flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center border-2 ${isTurn ? 'border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.4)]' : 'border-slate-700'}`}>
        <Icon className={isTurn ? 'text-indigo-400' : 'text-slate-500'} size={24} />
      </div>
      <div>
        <div className="font-bold text-slate-100 flex items-center gap-2 text-lg">
          {name} 
          <span className="text-xs text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded font-mono uppercase tracking-wider">{rating}</span>
          {isThinking && (
            <span className="flex items-center gap-1 text-xs text-indigo-400 ml-2 bg-indigo-500/20 px-2 py-1 rounded-full animate-pulse">
              <Cpu size={12}/> Thinking...
            </span>
          )}
        </div>
        <div className="flex items-center h-6 mt-1 overflow-x-auto max-w-[200px] no-scrollbar">
          {captured.map((p, i) => (
            <img key={i} src={PIECE_IMAGES[p]} alt={p} className="w-5 h-5 -ml-1.5 first:ml-0 drop-shadow-md brightness-110" draggable="false" />
          ))}
          {advantage > 0 && <span className="text-xs text-emerald-400 ml-2 font-bold bg-emerald-500/10 px-1.5 rounded">+{advantage.toFixed(1)}</span>}
        </div>
      </div>
    </div>
    <div className={`mt-3 sm:mt-0 px-5 py-2 rounded-xl font-mono text-xl font-black bg-slate-950 border ${isTurn ? 'border-indigo-500/50 text-white shadow-inner' : 'border-slate-800 text-slate-600'}`}>
      {color === 'w' ? '10:00' : 'AI'}
    </div>
  </div>
);

export default function App() {
  const [board, setBoard] = useState(INITIAL_BOARD);
  const [turn, setTurn] = useState('w');
  const [selected, setSelected] = useState(null);
  const [validMoves, setValidMoves] = useState([]);
  const [lastMove, setLastMove] = useState(null);
  const [castlingRights, setCastlingRights] = useState({ wK: true, wQ: true, bK: true, bQ: true });
  const [enPassantTarget, setEnPassantTarget] = useState(null);
  const [gameState, setGameState] = useState('active'); 
  const [inCheck, setInCheck] = useState(false);
  const [history, setHistory] = useState([]);
  const [isAIThinking, setIsAIThinking] = useState(false);

  // Material & Positional Evaluation for the Evaluation Bar
  const evaluation = useMemo(() => {
    let whiteScore = 0, blackScore = 0;
    const currentPieces = { w: {p:0, n:0, b:0, r:0, q:0}, b: {p:0, n:0, b:0, r:0, q:0} };
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece && piece[1] !== 'k') {
          currentPieces[piece[0]][piece[1]]++;
          const val = PIECE_VALUES[piece[1]] / 10;
          if (piece[0] === 'w') whiteScore += val; else blackScore += val;
        }
      }
    }
    const capturedByWhite = [], capturedByBlack = [];
    const initialCounts = { p:8, n:2, b:2, r:2, q:1 };
    ['p', 'n', 'b', 'r', 'q'].forEach(type => {
      for(let i=0; i < (initialCounts[type] - currentPieces.b[type]); i++) capturedByWhite.push('b'+type);
      for(let i=0; i < (initialCounts[type] - currentPieces.w[type]); i++) capturedByBlack.push('w'+type);
    });
    
    // AI's internal evaluation logic for the bar
    const rawEval = evaluateBoardState(board) / 10; 
    return { whiteScore, blackScore, advantage: rawEval, capturedByWhite, capturedByBlack };
  }, [board]);

  // Check Game State (Checkmate, Stalemate, Check)
  useEffect(() => {
    let kingR = -1, kingC = -1;
    let anyLegalMoves = false;
    const enemyColor = turn === 'w' ? 'b' : 'w';

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece && piece[0] === turn) {
          if (piece[1] === 'k') { kingR = r; kingC = c; }
          if (!anyLegalMoves && getLegalMoves(r, c, board, castlingRights, enPassantTarget).length > 0) {
            anyLegalMoves = true;
          }
        }
      }
    }
    const checkStatus = kingR !== -1 && isSquareAttacked(kingR, kingC, board, enemyColor);
    setInCheck(checkStatus);
    
    if (!anyLegalMoves) setGameState(checkStatus ? 'checkmate' : 'stalemate');
    else setGameState('active');
  }, [board, turn, castlingRights, enPassantTarget]);

  // AI Turn Handler
  useEffect(() => {
    if (turn === 'b' && gameState === 'active') {
      setIsAIThinking(true);
      
      // Use setTimeout to allow UI to render "Thinking..." state before heavy calculation
      const timeoutId = setTimeout(() => {
        const aiMove = getAIMove(board, 'b', castlingRights, enPassantTarget, 2);
        if (aiMove) {
          executeMove(aiMove.from.r, aiMove.from.c, aiMove.to.r, aiMove.to.c);
        }
        setIsAIThinking(false);
      }, 300);

      return () => clearTimeout(timeoutId);
    }
  }, [turn, gameState, board, castlingRights, enPassantTarget]);

  const executeMove = useCallback((fromR, fromC, toR, toC) => {
    const piece = board[fromR][fromC];
    const { newBoard, newCR, nextEP } = simulateMove(board, fromR, fromC, toR, toC, castlingRights, enPassantTarget);
    
    setBoard(newBoard);
    setCastlingRights(newCR);
    setEnPassantTarget(nextEP);
    setTurn(prev => prev === 'w' ? 'b' : 'w');
    setLastMove({ from: {r: fromR, c: fromC}, to: {r: toR, c: toC} });
    
    // Algebraic Notation generation
    const files = 'abcdefgh'; const ranks = '87654321';
    const isCapture = board[toR][toC] !== null || (piece[1] === 'p' && fromC !== toC);
    const pieceChar = piece[1] !== 'p' ? piece[1].toUpperCase() : '';
    const captureChar = isCapture ? (piece[1] === 'p' ? `${files[fromC]}x` : 'x') : '';
    const moveStr = `${pieceChar}${captureChar}${files[toC]}${ranks[toR]}`;
    
    setHistory(prev => [moveStr, ...prev]);
  }, [board, castlingRights, enPassantTarget]);

  const handleSquareClick = (r, c) => {
    if (gameState !== 'active' || turn !== 'w' || isAIThinking) return;
    const piece = board[r][c];

    if (selected) {
      if (validMoves.some(m => m.r === r && m.c === c)) {
        executeMove(selected.r, selected.c, r, c);
        setSelected(null);
        setValidMoves([]);
        return;
      }
      if (piece && piece[0] === turn) {
        setSelected({ r, c });
        setValidMoves(getLegalMoves(r, c, board, castlingRights, enPassantTarget));
        return;
      }
      setSelected(null);
      setValidMoves([]);
    } else if (piece && piece[0] === turn) {
      setSelected({ r, c });
      setValidMoves(getLegalMoves(r, c, board, castlingRights, enPassantTarget));
    }
  };

  const resetGame = () => {
    setBoard(INITIAL_BOARD); setTurn('w'); setSelected(null); setValidMoves([]); setLastMove(null);
    setCastlingRights({ wK: true, wQ: true, bK: true, bQ: true }); setEnPassantTarget(null);
    setGameState('active'); setInCheck(false); setHistory([]); setIsAIThinking(false);
  };

  // Convert Evaluation Advantage into a percentage for the bar (clamped 5% to 95%)
  const evalPerc = useMemo(() => {
    const scaled = evaluation.advantage * 3; // Scale factor for visuals
    return Math.max(5, Math.min(95, 50 + scaled));
  }, [evaluation]);

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-200 flex flex-col items-center py-8 px-4 lg:p-10 selection:bg-indigo-500/30 font-sans">
      
      {/* HEADER */}
      <div className="max-w-7xl w-full flex flex-col md:flex-row justify-between items-center mb-8 gap-6">
        <div className="flex items-center gap-5">
          <div className="p-3.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg shadow-indigo-600/30 border border-indigo-400/20">
            <Trophy className="text-white" size={32} />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 italic">
              GRANDMASTER <span className="text-indigo-400 not-italic">AI</span>
            </h1>
            <p className="text-slate-500 text-sm font-medium tracking-widest uppercase mt-1">Advanced Engine</p>
          </div>
        </div>
        <div className="flex gap-4 w-full md:w-auto">
          <button onClick={resetGame} className="flex-1 md:flex-none px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl transition-all shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-2 border border-indigo-500/50">
            <RefreshCw size={20} /> Reset Game
          </button>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-8 items-start max-w-7xl w-full justify-center">
        
        {/* GAME AREA */}
        <div className="flex flex-col gap-6 w-full lg:w-auto">
          <PlayerInfo 
            name="Grandmaster AI" color="b" rating="2800" 
            isTurn={turn === 'b'} captured={evaluation.capturedByBlack} 
            advantage={evaluation.advantage < 0 ? Math.abs(evaluation.advantage) : 0} 
            isThinking={isAIThinking} icon={Cpu}
          />
          
          <div className="flex gap-4 sm:gap-6 relative group">
            {/* EVAL BAR */}
            <div className="w-5 sm:w-6 h-[320px] sm:h-[480px] lg:h-[580px] bg-[#1a1c23] rounded-full overflow-hidden border-2 border-slate-800 shadow-inner flex flex-col justify-end relative">
              <div className="absolute top-1/2 left-0 w-full h-0.5 bg-white/20 z-10 -translate-y-1/2" />
              <div className="bg-slate-200 w-full transition-all duration-700 ease-out shadow-[0_0_20px_rgba(255,255,255,0.2)]" style={{ height: `${evalPerc}%` }} />
            </div>

            {/* BOARD CONTAINER */}
            <div className="relative rounded-2xl overflow-hidden shadow-[0_20px_50px_-15px_rgba(0,0,0,0.8)] border-[10px] sm:border-[12px] border-[#22252e]">
              
              {/* CHECK WARNING OVERLAY */}
              {inCheck && gameState === 'active' && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-600/90 backdrop-blur-sm text-white px-6 py-2.5 rounded-full font-black z-40 shadow-[0_0_30px_rgba(220,38,38,0.5)] animate-pulse flex items-center gap-2 border border-red-400">
                  <AlertTriangle size={18} /> CHECK!
                </div>
              )}
              
              {/* END GAME OVERLAY */}
              {gameState !== 'active' && (
                <div className="absolute inset-0 bg-slate-950/80 z-50 flex items-center justify-center backdrop-blur-md">
                   <div className="bg-[#12141a] border border-indigo-500/50 p-10 sm:p-12 rounded-3xl shadow-2xl text-center scale-105 transform transition-transform">
                      <Trophy className="mx-auto text-yellow-500 mb-6 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]" size={64} />
                      <h2 className="text-3xl sm:text-4xl font-black mb-3 text-white uppercase tracking-tighter">
                        {gameState === 'checkmate' ? 'Checkmate' : 'Stalemate'}
                      </h2>
                      <p className="text-slate-400 text-lg mb-8 font-medium">
                        {gameState === 'checkmate' ? (turn === 'w' ? 'Black claims victory' : 'White claims victory') : 'The game is a draw'}
                      </p>
                      <button onClick={resetGame} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black text-xl transition-all shadow-lg shadow-indigo-600/30">
                        PLAY AGAIN
                      </button>
                   </div>
                </div>
              )}

              {/* THE CHESS BOARD */}
              <div className="grid grid-cols-8 grid-rows-8 w-[320px] h-[320px] sm:w-[480px] sm:h-[480px] lg:w-[580px] lg:h-[580px]">
                {board.map((row, r) => row.map((piece, c) => {
                  const isLight = (r + c) % 2 === 0;
                  const isSel = selected?.r === r && selected?.c === c;
                  const isVal = validMoves.some(m => m.r === r && m.c === c);
                  const isLast = lastMove && ((lastMove.from.r === r && lastMove.from.c === c) || (lastMove.to.r === r && lastMove.to.c === c));
                  
                  return (
                    <div key={`${r}-${c}`} onClick={() => handleSquareClick(r, c)} className={`relative flex items-center justify-center cursor-pointer transition-colors duration-200 ${isLight ? 'bg-[#e0e4e7]' : 'bg-[#7c94a3]'}`}>
                      {/* Coordinates */}
                      {c === 0 && <span className={`absolute top-0.5 sm:top-1 left-1 sm:left-1.5 text-[8px] sm:text-[10px] font-bold z-10 ${isLight ? 'text-[#7c94a3]' : 'text-[#e0e4e7]'}`}>{8 - r}</span>}
                      {r === 7 && <span className={`absolute bottom-0 sm:bottom-0.5 right-1 sm:right-1.5 text-[8px] sm:text-[10px] font-bold z-10 ${isLight ? 'text-[#7c94a3]' : 'text-[#e0e4e7]'}`}>{String.fromCharCode(97 + c)}</span>}
                      
                      {/* Highlights */}
                      {isLast && <div className="absolute inset-0 bg-yellow-400/40" />}
                      {isSel && <div className="absolute inset-0 bg-indigo-500/50 border-4 border-indigo-600 z-10" />}
                      
                      {/* Valid Move Dots/Rings */}
                      {isVal && (
                        <div className={`absolute z-30 flex items-center justify-center w-full h-full`}>
                          {piece ? <div className="w-[85%] h-[85%] border-[6px] border-black/20 rounded-full" /> : <div className="w-1/3 h-1/3 bg-black/20 rounded-full" />}
                        </div>
                      )}
                      
                      {/* Piece Image */}
                      {piece && (
                        <img 
                          src={PIECE_IMAGES[piece]} 
                          alt={piece} 
                          className={`w-[85%] h-[85%] object-contain z-20 transition-all duration-300 ${isSel ? 'scale-110 -translate-y-2 drop-shadow-[0_15px_15px_rgba(0,0,0,0.5)]' : 'hover:scale-105 drop-shadow-lg'}`} 
                          draggable="false" 
                        />
                      )}
                    </div>
                  );
                }))}
              </div>
            </div>
          </div>
          
          <PlayerInfo 
            name="You (Challenger)" color="w" rating="1500" 
            isTurn={turn === 'w'} captured={evaluation.capturedByWhite} 
            advantage={evaluation.advantage > 0 ? evaluation.advantage : 0} 
            isThinking={false} icon={User}
          />
        </div>

        {/* SIDEBAR LOG */}
        <div className="w-full xl:w-96 flex flex-col gap-6">
          <div className="bg-[#12141a] p-5 sm:p-6 rounded-3xl border border-slate-800 shadow-xl flex-1 flex flex-col min-h-[500px]">
            <div className="flex gap-4 mb-6">
              <button className="flex-1 py-3.5 bg-slate-900/80 hover:bg-red-900/30 text-slate-300 hover:text-red-400 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all border border-slate-800 hover:border-red-500/30">
                <Flag size={18}/> Resign
              </button>
              <button className="flex-1 py-3.5 bg-slate-900/80 hover:bg-slate-800 text-slate-300 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all border border-slate-800">
                Draw
              </button>
            </div>
            
            <div className="flex-1 bg-[#090a0f] rounded-2xl border border-slate-800 overflow-hidden flex flex-col shadow-inner">
              <div className="p-4 bg-slate-900/50 border-b border-slate-800 font-bold text-indigo-400 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity size={18} /> MATCH LOG
                </div>
                <div className="text-xs text-slate-500 font-mono">SAN</div>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-1.5 font-mono text-sm scrollbar-hide">
                {history.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-600 italic gap-3">
                    <span className="opacity-50 text-2xl">♖ ♘ ♗</span>
                    Make your first move
                  </div>
                ) : (
                  Array.from({ length: Math.ceil(history.length / 2) }).map((_, i) => {
                    const idx = history.length - 1 - (i * 2);
                    const w = history[idx]; const b = history[idx - 1];
                    const isLatest = i === 0;
                    return (
                      <div key={i} className={`flex gap-2 p-2 rounded-xl transition-colors ${isLatest ? 'bg-indigo-500/5 border border-indigo-500/20' : 'hover:bg-slate-900/50'}`}>
                        <span className="w-8 text-slate-600 font-bold text-right pt-1">{Math.ceil(history.length / 2) - i}.</span>
                        <span className={`flex-1 px-3 py-1 rounded-lg ${isLatest && !b ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-300 bg-slate-800'}`}>{w}</span>
                        <span className={`flex-1 px-3 py-1 rounded-lg ${isLatest && b ? 'bg-indigo-600 text-white shadow-md' : (b ? 'text-slate-300 bg-slate-800' : 'opacity-0')}`}>{b || '—'}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
