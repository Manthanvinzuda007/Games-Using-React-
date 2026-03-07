import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw, Trophy, AlertTriangle, User, Settings, Flag } from 'lucide-react';

// --- CHESS ENGINE LOGIC & CONSTANTS ---

const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

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

const cloneBoard = (board) => board.map(row => [...row]);
const isValid = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;

const isSquareAttacked = (r, c, board, attackerColor) => {
  const enemyRook = attackerColor + 'r';
  const enemyBishop = attackerColor + 'b';
  const enemyQueen = attackerColor + 'q';
  const enemyKnight = attackerColor + 'n';
  const enemyKing = attackerColor + 'k';
  const enemyPawn = attackerColor + 'p';

  const straights = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (let [dr, dc] of straights) {
    let nr = r + dr, nc = c + dc;
    while (isValid(nr, nc)) {
      const piece = board[nr][nc];
      if (piece) {
        if (piece === enemyRook || piece === enemyQueen) return true;
        break;
      }
      nr += dr; nc += dc;
    }
  }

  const diagonals = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  for (let [dr, dc] of diagonals) {
    let nr = r + dr, nc = c + dc;
    while (isValid(nr, nc)) {
      const piece = board[nr][nc];
      if (piece) {
        if (piece === enemyBishop || piece === enemyQueen) return true;
        break;
      }
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
  const color = piece[0];
  const type = piece[1];
  const moves = [];
  const addMove = (nr, nc) => moves.push({ r: nr, c: nc });

  const isEnemy = (nr, nc) => board[nr][nc] && board[nr][nc][0] !== color;
  const isEmpty = (nr, nc) => !board[nr][nc];

  const slide = (directions) => {
    for (let [dr, dc] of directions) {
      let nr = r + dr, nc = c + dc;
      while (isValid(nr, nc)) {
        if (isEmpty(nr, nc)) {
          addMove(nr, nc);
        } else {
          if (isEnemy(nr, nc)) addMove(nr, nc);
          break;
        }
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
    if (kingR !== -1 && !isSquareAttacked(kingR, kingC, tempBoard, enemyColor)) legalMoves.push(move);
  }
  return legalMoves;
};

const evaluateBoard = (board) => {
  let whiteScore = 0;
  let blackScore = 0;
  const currentPieces = { w: {p:0, n:0, b:0, r:0, q:0}, b: {p:0, n:0, b:0, r:0, q:0} };
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece) {
        const color = piece[0];
        const type = piece[1];
        if (type !== 'k') {
          currentPieces[color][type]++;
          const val = PIECE_VALUES[type];
          if (color === 'w') whiteScore += val; else blackScore += val;
        }
      }
    }
  }
  const capturedByWhite = [];
  const capturedByBlack = [];
  const initialCounts = { p:8, n:2, b:2, r:2, q:1 };
  ['p', 'n', 'b', 'r', 'q'].forEach(type => {
    for(let i=0; i < (initialCounts[type] - currentPieces.b[type]); i++) capturedByWhite.push('b'+type);
    for(let i=0; i < (initialCounts[type] - currentPieces.w[type]); i++) capturedByBlack.push('w'+type);
  });
  return { whiteScore, blackScore, advantage: whiteScore - blackScore, capturedByWhite, capturedByBlack };
};

// --- PLAYER INFO COMPONENT ---
const PlayerInfo = ({ name, color, rating, isTurn, captured, advantage }) => (
  <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center w-full py-3 px-4 rounded-xl transition-all duration-300 ${isTurn ? 'bg-slate-800/80 border border-indigo-500/30' : 'bg-transparent'}`}>
    <div className="flex items-center gap-4">
      <div className={`w-12 h-12 rounded-lg bg-slate-900 flex items-center justify-center border-2 ${isTurn ? 'border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.3)]' : 'border-slate-700'}`}>
        <User className={color === 'w' ? 'text-white' : 'text-slate-500'} size={28} />
      </div>
      <div>
        <div className="font-bold text-slate-100 flex items-center gap-2 text-lg">
          {name} <span className="text-xs text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded font-mono uppercase tracking-wider">{rating}</span>
        </div>
        <div className="flex items-center h-6 mt-1 overflow-x-auto max-w-[200px] no-scrollbar">
          {captured.map((p, i) => (
            <img key={i} src={PIECE_IMAGES[p]} alt={p} className="w-5 h-5 -ml-1.5 first:ml-0 drop-shadow-md brightness-110" />
          ))}
          {advantage > 0 && <span className="text-xs text-indigo-300 ml-2 font-bold">+{advantage}</span>}
        </div>
      </div>
    </div>
    <div className={`mt-3 sm:mt-0 px-5 py-2 rounded-lg font-mono text-2xl font-black bg-slate-900 border ${isTurn ? 'border-indigo-500/50 text-white shadow-inner' : 'border-slate-800 text-slate-600'}`}>
      10:00
    </div>
  </div>
);

// --- MAIN APP COMPONENT ---
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

  const material = useMemo(() => evaluateBoard(board), [board]);

  useEffect(() => {
    let kingR = -1, kingC = -1;
    let anyLegalMoves = false;
    const enemyColor = turn === 'w' ? 'b' : 'w';

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece && piece[0] === turn) {
          if (piece[1] === 'k') { kingR = r; kingC = c; }
          if (!anyLegalMoves) {
            const moves = getLegalMoves(r, c, board, castlingRights, enPassantTarget);
            if (moves.length > 0) anyLegalMoves = true;
          }
        }
      }
    }
    const checkStatus = isSquareAttacked(kingR, kingC, board, enemyColor);
    setInCheck(checkStatus);
    if (!anyLegalMoves) setGameState(checkStatus ? 'checkmate' : 'stalemate');
    else setGameState('active');
  }, [board, turn, castlingRights, enPassantTarget]);

  const handleSquareClick = (r, c) => {
    if (gameState !== 'active') return;
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

  const executeMove = (fromR, fromC, toR, toC) => {
    const newBoard = cloneBoard(board);
    const piece = newBoard[fromR][fromC];
    let nextEP = null;
    let newCR = { ...castlingRights };

    if (piece[1] === 'p' && enPassantTarget && toR === enPassantTarget.r && toC === enPassantTarget.c) newBoard[fromR][toC] = null;
    if (piece[1] === 'p' && Math.abs(toR - fromR) === 2) nextEP = { r: (fromR + toR) / 2, c: toC };
    if (piece[1] === 'k' && Math.abs(toC - fromC) === 2) {
      if (toC === 6) { newBoard[fromR][5] = newBoard[fromR][7]; newBoard[fromR][7] = null; }
      else { newBoard[fromR][3] = newBoard[fromR][0]; newBoard[fromR][0] = null; }
    }

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
    if (piece[1] === 'p' && (toR === 0 || toR === 7)) newBoard[toR][toC] = piece[0] + 'q';

    setBoard(newBoard);
    setEnPassantTarget(nextEP);
    setCastlingRights(newCR);
    setTurn(turn === 'w' ? 'b' : 'w');
    setLastMove({ from: {r: fromR, c: fromC}, to: {r: toR, c: toC} });
    const files = 'abcdefgh'; const ranks = '87654321';
    setHistory(prev => [`${piece[1] !== 'p' ? piece[1].toUpperCase() : ''}${files[fromC]}${ranks[fromR]}→${files[toC]}${ranks[toR]}`, ...prev]);
  };

  const resetGame = () => {
    setBoard(INITIAL_BOARD); setTurn('w'); setSelected(null); setValidMoves([]); setLastMove(null);
    setCastlingRights({ wK: true, wQ: true, bK: true, bQ: true }); setEnPassantTarget(null);
    setGameState('active'); setInCheck(false); setHistory([]);
  };

  const evalPerc = useMemo(() => Math.max(5, Math.min(95, 50 + (material.advantage * 4))), [material]);

  return (
    <div className="min-h-screen bg-[#0f1115] text-slate-200 flex flex-col items-center justify-center p-4 lg:p-10 selection:bg-indigo-500/30">
      
      {/* HEADER */}
      <div className="max-w-6xl w-full flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-600/20">
            <Trophy className="text-white" size={28} />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white italic">
            GRANDMASTER <span className="text-indigo-500 not-italic">PRO</span>
          </h1>
        </div>
        <div className="flex gap-4">
          <button className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all border border-slate-700"><Settings size={20} /></button>
          <button onClick={resetGame} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-xl shadow-indigo-600/20 flex items-center gap-2">
            <RefreshCw size={20} /> New Game
          </button>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-10 items-start max-w-7xl w-full justify-center">
        
        {/* GAME AREA */}
        <div className="flex flex-col gap-6 w-full lg:w-auto">
          <PlayerInfo name="Grandmaster_AI" color="b" rating="2800" isTurn={turn === 'b'} captured={material.capturedByBlack} advantage={material.advantage < 0 ? -material.advantage : 0} />
          
          <div className="flex gap-5 relative group">
            {/* EVAL BAR */}
            <div className="w-5 h-[320px] sm:h-[480px] lg:h-[580px] bg-slate-800 rounded-full overflow-hidden border border-slate-700 shadow-inner flex flex-col justify-end">
              <div className="bg-white w-full transition-all duration-700 ease-out shadow-[0_0_20px_rgba(255,255,255,0.4)]" style={{ height: `${evalPerc}%` }} />
            </div>

            {/* BOARD */}
            <div className="relative rounded-xl overflow-hidden shadow-[0_30px_60px_-15px_rgba(0,0,0,0.7)] border-8 border-[#2d3436]">
              {inCheck && gameState === 'active' && (
                <div className="absolute top-10 left-1/2 -translate-x-1/2 bg-red-600 text-white px-8 py-3 rounded-full font-black z-40 shadow-2xl animate-bounce flex items-center gap-2">
                  <AlertTriangle size={20} /> KING IN CHECK!
                </div>
              )}
              {gameState !== 'active' && (
                <div className="absolute inset-0 bg-slate-950/80 z-50 flex items-center justify-center backdrop-blur-md">
                   <div className="bg-slate-900 border border-indigo-500/50 p-12 rounded-3xl shadow-2xl text-center scale-110">
                      <Trophy className="mx-auto text-yellow-500 mb-6" size={64} />
                      <h2 className="text-4xl font-black mb-3 text-white uppercase tracking-tighter">{gameState === 'checkmate' ? 'Victory!' : 'Draw'}</h2>
                      <p className="text-slate-400 text-lg mb-8">{gameState === 'checkmate' ? `${turn === 'w' ? 'Black' : 'White'} dominates the board` : 'A perfect stalemate'}</p>
                      <button onClick={resetGame} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black text-xl transition-all shadow-lg shadow-indigo-600/30">REMATCH</button>
                   </div>
                </div>
              )}

              <div className="grid grid-cols-8 grid-rows-8 w-[320px] h-[320px] sm:w-[480px] sm:h-[480px] lg:w-[580px] lg:h-[580px]">
                {board.map((row, r) => row.map((piece, c) => {
                  const isLight = (r + c) % 2 === 0;
                  const isSel = selected?.r === r && selected?.c === c;
                  const isVal = validMoves.some(m => m.r === r && m.c === c);
                  const isLast = lastMove && ((lastMove.from.r === r && lastMove.from.c === c) || (lastMove.to.r === r && lastMove.to.c === c));
                  return (
                    <div key={`${r}-${c}`} onClick={() => handleSquareClick(r, c)} className={`relative flex items-center justify-center cursor-pointer transition-colors duration-200 ${isLight ? 'bg-[#dee3e6]' : 'bg-[#8ca2ad]'}`}>
                      {isLast && <div className="absolute inset-0 bg-yellow-400/30" />}
                      {isSel && <div className="absolute inset-0 bg-indigo-500/40 border-4 border-indigo-500 z-10" />}
                      {isVal && <div className={`absolute z-30 ${piece ? 'w-full h-full border-[6px] border-black/10 rounded-full' : 'w-4 h-4 bg-black/15 rounded-full'}`} />}
                      {c === 0 && <span className={`absolute top-1 left-1.5 text-[10px] sm:text-xs font-bold ${isLight ? 'text-[#8ca2ad]' : 'text-[#dee3e6]'}`}>{8 - r}</span>}
                      {r === 7 && <span className={`absolute bottom-0.5 right-1.5 text-[10px] sm:text-xs font-bold ${isLight ? 'text-[#8ca2ad]' : 'text-[#dee3e6]'}`}>{String.fromCharCode(97 + c)}</span>}
                      {piece && <img src={PIECE_IMAGES[piece]} alt={piece} className={`w-[90%] h-[90%] object-contain z-20 transition-all duration-300 ${isSel ? 'scale-110 -translate-y-2 drop-shadow-2xl' : 'hover:scale-105 drop-shadow-lg'}`} draggable="false" />}
                    </div>
                  );
                }))}
              </div>
            </div>
          </div>
          <PlayerInfo name="You (Challenger)" color="w" rating="1500" isTurn={turn === 'w'} captured={material.capturedByWhite} advantage={material.advantage > 0 ? material.advantage : 0} />
        </div>

        {/* SIDEBAR */}
        <div className="w-full xl:w-96 flex flex-col gap-6">
          <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800 shadow-xl flex-1 flex flex-col min-h-[500px]">
            <div className="flex gap-4 mb-6">
              <button className="flex-1 py-4 bg-slate-800 hover:bg-red-900/40 hover:text-red-400 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all border border-slate-700"><Flag size={18}/> Resign</button>
              <button className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all border border-slate-700">Draw</button>
            </div>
            <div className="flex-1 bg-slate-950/50 rounded-2xl border border-slate-800 overflow-hidden flex flex-col">
              <div className="p-4 bg-slate-900 border-b border-slate-800 font-bold text-indigo-400 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" /> MOVE HISTORY
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2 font-mono scrollbar-hide">
                {history.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-600 italic">Waiting for first move...</div>
                ) : (
                  Array.from({ length: Math.ceil(history.length / 2) }).map((_, i) => {
                    const idx = history.length - 1 - (i * 2);
                    const w = history[idx]; const b = history[idx - 1];
                    return (
                      <div key={i} className="flex gap-2 text-sm p-2 hover:bg-slate-800/50 rounded-xl transition-colors group">
                        <span className="w-8 text-slate-600 font-bold">{Math.ceil(history.length / 2) - i}.</span>
                        <span className="flex-1 text-slate-200 bg-slate-800 px-3 py-1 rounded-lg group-hover:bg-indigo-900/20">{w}</span>
                        <span className="flex-1 text-slate-200 bg-slate-800 px-3 py-1 rounded-lg group-hover:bg-slate-700">{b || '—'}</span>
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