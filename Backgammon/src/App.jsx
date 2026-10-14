// Backgammon Master — single-file React game
// Original base by Manthan Vinzuda · rebuilt & extended: new engine, 4 AI levels (up to 2-ply lookahead),
// doubling cube, match play (Crawford rule), gammon/backgammon scoring, hints, analysis bar, move log.
import React, { useState, useEffect, useCallback, useMemo, useRef, useReducer } from 'react';

/* =====================================================================
   ENGINE  (pure functions, no React)
   Board: pts[0..23]; positive = White (P1) checkers, negative = Black (P2).
   White moves 24 -> 1 (index 23 -> 0), home = indices 0-5.
   Black moves 1 -> 24 (index 0 -> 23), home = indices 18-23.
   ===================================================================== */
export const P1 = 1;
export const P2 = 2;
const N = 24;
const other = (p) => 3 - p;
const sgn = (p) => (p === P1 ? 1 : -1);

export const initialPosition = () => {
  const pts = new Array(N).fill(0);
  pts[0] = -2; pts[5] = 5; pts[7] = 3; pts[11] = -5;
  pts[12] = 5; pts[16] = -3; pts[18] = -5; pts[23] = 2;
  return { pts, bar: [0, 0, 0], off: [0, 0, 0] };
};

const owns = (pts, i, p) => (p === P1 ? pts[i] > 0 : pts[i] < 0);
const cnt = (pts, i, p) => (p === P1 ? (pts[i] > 0 ? pts[i] : 0) : (pts[i] < 0 ? -pts[i] : 0));
const blockedFor = (pts, i, p) => (p === P1 ? pts[i] <= -2 : pts[i] >= 2);

export const pipCount = (s, p) => {
  let t = s.bar[p] * 25;
  const pts = s.pts;
  if (p === P1) { for (let i = 0; i < N; i++) if (pts[i] > 0) t += pts[i] * (i + 1); }
  else { for (let i = 0; i < N; i++) if (pts[i] < 0) t += -pts[i] * (24 - i); }
  return t;
};

const allHome = (s, p) => {
  if (s.bar[p] > 0) return false;
  if (p === P1) { for (let i = 6; i < N; i++) if (s.pts[i] > 0) return false; }
  else { for (let i = 0; i < 18; i++) if (s.pts[i] < 0) return false; }
  return true;
};

export const hasContact = (s) => {
  let p1max = s.bar[P1] > 0 ? 24 : -1;
  let p2min = s.bar[P2] > 0 ? -1 : 24;
  for (let i = 0; i < N; i++) {
    if (s.pts[i] > 0 && i > p1max) p1max = i;
    if (s.pts[i] < 0 && i < p2min) p2min = i;
  }
  return p1max > p2min;
};

const removeOne = (arr, v) => {
  const i = arr.indexOf(v);
  return i < 0 ? arr : arr.slice(0, i).concat(arr.slice(i + 1));
};

/** All single-checker moves for one die value. */
export const movesForDie = (s, p, die) => {
  const out = [];
  const sg = sgn(p);
  const dir = -sg;
  const pts = s.pts;
  if (s.bar[p] > 0) {
    const e = p === P1 ? 24 - die : die - 1;
    if (!blockedFor(pts, e, p)) out.push({ from: 'bar', to: e, die, hit: pts[e] === -sg });
    return out;
  }
  const home = allHome(s, p);
  for (let i = 0; i < N; i++) {
    if (!owns(pts, i, p)) continue;
    const t = i + dir * die;
    if (t >= 0 && t < N) {
      if (!blockedFor(pts, t, p)) out.push({ from: i, to: t, die, hit: pts[t] === -sg });
    } else if (home) {
      const exact = p === P1 ? t === -1 : t === 24;
      if (exact) out.push({ from: i, to: 'off', die, hit: false });
      else {
        let back = false;
        if (p === P1) { for (let j = i + 1; j <= 5; j++) if (pts[j] > 0) { back = true; break; } }
        else { for (let j = i - 1; j >= 18; j--) if (pts[j] < 0) { back = true; break; } }
        if (!back) out.push({ from: i, to: 'off', die, hit: false });
      }
    }
  }
  return out;
};

export const applyMove = (s, m, p) => {
  const ns = { pts: s.pts.slice(), bar: s.bar.slice(), off: s.off.slice() };
  const sg = sgn(p);
  if (m.from === 'bar') ns.bar[p]--; else ns.pts[m.from] -= sg;
  if (m.to === 'off') ns.off[p]++;
  else {
    if (ns.pts[m.to] === -sg) { ns.pts[m.to] = 0; ns.bar[other(p)]++; }
    ns.pts[m.to] += sg;
  }
  return ns;
};

const posKey = (s) => {
  let k = '';
  for (let i = 0; i < N; i++) k += String.fromCharCode(80 + s.pts[i]);
  return k + String.fromCharCode(65 + s.bar[1], 65 + s.bar[2], 65 + s.off[1], 65 + s.off[2]);
};

/** depth(s, dice) = max number of dice that can be played (the "must use as many dice as possible" rule). */
const makeAnalyzer = (p) => {
  const memo = new Map();
  const depth = (st, rem) => {
    if (!rem.length) return 0;
    const k = posKey(st) + '|' + rem.join('');
    const hit = memo.get(k);
    if (hit !== undefined) return hit;
    let best = 0;
    outer:
    for (const d of new Set(rem)) {
      const ms = movesForDie(st, p, d);
      if (!ms.length) continue;
      const rr = removeOne(rem, d);
      for (const m of ms) {
        const v = 1 + depth(applyMove(st, m, p), rr);
        if (v > best) best = v;
        if (best === rem.length) break outer;
      }
    }
    memo.set(k, best);
    return best;
  };
  return depth;
};

/** Legal first moves for the remaining dice (respects max-dice and larger-die rules). */
export const firstMoves = (s, p, dice) => {
  if (!dice.length) return [];
  const depth = makeAnalyzer(p);
  const total = depth(s, dice);
  if (!total) return [];
  let list = [];
  for (const d of new Set(dice)) {
    const rr = removeOne(dice, d);
    for (const m of movesForDie(s, p, d)) {
      if (1 + depth(applyMove(s, m, p), rr) === total) list.push(m);
    }
  }
  if (total === 1 && dice.length === 2 && dice[0] !== dice[1]) {
    const big = Math.max(dice[0], dice[1]);
    if (list.some((m) => m.die === big)) list = list.filter((m) => m.die === big);
  }
  return list;
};

/** Every distinct complete turn (unique final positions) for the given dice. */
export const generateTurns = (s, p, dice) => {
  const depth = makeAnalyzer(p);
  const total = depth(s, dice);
  if (!total) return [];
  const big = total === 1 && dice.length === 2 && dice[0] !== dice[1] ? Math.max(dice[0], dice[1]) : 0;
  const bigPossible = big ? movesForDie(s, p, big).length > 0 : false;
  const finals = new Map();
  const seen = new Set();
  const rec = (st, rem, moves) => {
    if (moves.length === total) {
      const k = posKey(st);
      if (!finals.has(k)) finals.set(k, { moves, pos: st });
      return;
    }
    const vk = posKey(st) + '|' + rem.join('');
    if (seen.has(vk)) return;
    seen.add(vk);
    const need = total - moves.length - 1;
    for (const d of new Set(rem)) {
      if (bigPossible && moves.length === 0 && d !== big) continue;
      const rr = removeOne(rem, d);
      for (const m of movesForDie(st, p, d)) {
        const ns = applyMove(st, m, p);
        if (depth(ns, rr) === need) rec(ns, rr, [...moves, m]);
      }
    }
  };
  rec(s, dice, []);
  return [...finals.values()];
};

/** Destinations reachable by one checker from `origin`, including combined dice (e.g. 3+4). Map: to -> path[] */
export const reachable = (s, p, dice, origin) => {
  const out = new Map();
  const visited = new Set();
  let level = [{ st: s, rem: dice, from: origin, path: [] }];
  for (let depth = 0; depth < 4 && level.length; depth++) {
    const next = [];
    for (const node of level) {
      const ms = firstMoves(node.st, p, node.rem).filter((m) => m.from === node.from).sort((a, b) => a.die - b.die);
      for (const m of ms) {
        const path = [...node.path, m];
        if (!out.has(m.to)) out.set(m.to, path);
        if (m.to !== 'off') {
          const ns = applyMove(node.st, m, p);
          const rem = removeOne(node.rem, m.die);
          const vk = posKey(ns) + '|' + rem.join('') + '|' + m.to;
          if (rem.length && !visited.has(vk)) { visited.add(vk); next.push({ st: ns, rem, from: m.to, path }); }
        }
      }
    }
    level = next;
  }
  return out;
};

/** 1 = single game, 2 = gammon, 3 = backgammon */
export const winMultiplier = (s, winner) => {
  const loser = other(winner);
  if (s.off[loser] > 0) return 1;
  if (s.bar[loser] > 0) return 3;
  if (winner === P1) { for (let i = 0; i < 6; i++) if (s.pts[i] < 0) return 3; }
  else { for (let i = 18; i < N; i++) if (s.pts[i] > 0) return 3; }
  return 2;
};

/* ---------------------------- EVALUATION ---------------------------- */
const ROLLS = [];
for (let a = 1; a <= 6; a++) for (let b = a; b <= 6; b++) {
  ROLLS.push({ a, b, w: a === b ? 1 / 36 : 2 / 36, dice: a === b ? [a, a, a, a] : [a, b] });
}

// value of owning a made point, indexed by the point number from the owner's own perspective (1 = ace point)
const PV = [0, 0.5, 1.5, 3.5, 5.5, 7.5, 6.5, 6, 4, 2.5, 1.5, 1, 1, 1.5, 0.5, 0.5, 1, 2, 3.5, 3, 6, 5, 3.5, 2, 1];
const PRIME = [0, 0, 0, 3, 8, 18, 35, 50];
const MADE = new Array(26).fill(false);
const OPPQ = new Array(26).fill(0);

const homeMade = (s, owner) => {
  let h = 0;
  if (owner === P1) { for (let i = 0; i < 6; i++) if (s.pts[i] >= 2) h++; }
  else { for (let i = 18; i < N; i++) if (s.pts[i] <= -2) h++; }
  return h;
};

// Expected pips lost (+ tempo) if x's blots get hit next roll, summed over all 36 opponent rolls.
const riskLoss = (s, x) => {
  const h = other(x);
  const blots = [];
  for (let i = 0; i < N; i++) {
    if (x === P1 ? s.pts[i] === 1 : s.pts[i] === -1) blots.push({ i, lost: x === P1 ? 24 - i : i + 1 });
  }
  if (!blots.length) return 0;
  const hb = homeMade(s, h);
  const extra = 8 + 12 * (hb / 6) * (hb / 6);
  const dirH = h === P2 ? 1 : -1;
  const barN = s.bar[h];
  const srcs = [];
  if (barN > 0) srcs.push(h === P2 ? -1 : 24);
  else for (let i = 0; i < N; i++) if (owns(s.pts, i, h)) srcs.push(i);

  const hits = (b, r) => {
    for (const j of srcs) {
      const d = (b - j) * dirH;
      if (d <= 0) continue;
      if (d === r.a || d === r.b) return true;
      if (barN > 1) continue;
      if (r.a === r.b) {
        if (d % r.a === 0 && d / r.a <= 4) {
          let ok = true;
          for (let k = 1; k < d / r.a; k++) if (blockedFor(s.pts, j + dirH * r.a * k, h)) { ok = false; break; }
          if (ok) return true;
        }
      } else if (d === r.a + r.b) {
        if (!blockedFor(s.pts, j + dirH * r.a, h) || !blockedFor(s.pts, j + dirH * r.b, h)) return true;
      }
    }
    return false;
  };

  let total = 0;
  for (const r of ROLLS) {
    let best = 0;
    for (const bl of blots) if (bl.lost + extra > best && hits(bl.i, r)) best = bl.lost + extra;
    total += r.w * best;
  }
  return total;
};

const F = (s, x, mover, contact, useRisk) => {
  const o = other(x);
  let v = -(pipCount(s, x) + 1.2 * (15 - s.off[x]));
  if (!contact) return v;
  MADE.fill(false); OPPQ.fill(0);
  let blots = 0;
  for (let i = 0; i < N; i++) {
    const c = cnt(s.pts, i, x);
    if (c) {
      const q = x === P1 ? i + 1 : 24 - i;
      if (c >= 2) { MADE[q] = true; v += 1.8 * PV[q]; if (c > 3) v -= (c - 3) * 1.2; }
      else blots++;
    }
    const oc = cnt(s.pts, i, o);
    if (oc) OPPQ[x === P1 ? i + 1 : 24 - i] += oc;
  }
  // primes: consecutive made points that trap opposing checkers behind them
  let run = 0, behind = s.bar[o];
  for (let q = 1; q <= 25; q++) {
    if (q <= 24 && MADE[q]) { run++; }
    else {
      if (run >= 3) {
        const start = q - run;
        let trapped = s.bar[o];
        for (let k = 1; k < start; k++) trapped += OPPQ[k];
        v += PRIME[Math.min(run, 7)] * (trapped > 0 ? 1 : 0.15);
      }
      run = 0;
    }
    if (q <= 24) behind += 0;
  }
  const h = homeMade(s, o);
  v -= s.bar[x] * (4 + 12 * (h / 6) * (h / 6));
  if (useRisk) v -= riskLoss(s, x) * (x === mover ? 0.35 : 1);
  else v -= blots * 5;
  return v;
};

/** Position score from p's point of view, ~1 unit = 1 pip. `mover` is who rolls next. */
export const evaluate = (s, p, mover) => {
  const o = other(p);
  if (s.off[p] === 15) return 1e6;
  if (s.off[o] === 15) return -1e6;
  const c = hasContact(s);
  return F(s, p, mover, c, true) - F(s, o, mover, c, true);
};
const quickEval = (s, p) => {
  const o = other(p);
  const c = hasContact(s);
  return F(s, p, p, c, false) - F(s, o, p, c, false);
};

/** Rough win probability for p (engine estimate). */
export const winProb = (s, p, mover) => {
  const o = other(p);
  if (s.off[p] === 15) return 1;
  if (s.off[o] === 15) return 0;
  if (!hasContact(s)) {
    const pm = pipCount(s, p), po = pipCount(s, o);
    const lead = po - pm + (mover === p ? 4 : -4);
    const sc = Math.max(4, 0.66 * Math.sqrt(pm + po));
    return 1 / (1 + Math.exp(-lead / sc));
  }
  return 1 / (1 + Math.exp(-evaluate(s, p, mover) / 16));
};

/* ------------------------------ AI -------------------------------- */
export const LEVELS = {
  novice: { label: 'Novice', blurb: 'Makes plenty of mistakes', noise: 45, ply: 1, top: 0, doubleMin: 0.84, takeMin: 0.18 },
  club:   { label: 'Club', blurb: 'Solid but beatable', noise: 10, ply: 1, top: 0, doubleMin: 0.76, takeMin: 0.22 },
  expert: { label: 'Expert', blurb: 'Full 1-ply evaluation', noise: 0, ply: 1, top: 0, doubleMin: 0.70, takeMin: 0.25 },
  master: { label: 'Master', blurb: '2-ply lookahead over all 21 replies', noise: 0, ply: 2, top: 8, doubleMin: 0.70, takeMin: 0.25 },
};

const gauss = () => {
  let u = 0, v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

export const chooseTurn = (s, p, dice, level = 'expert') => {
  const turns = generateTurns(s, p, dice);
  if (!turns.length) return null;
  if (turns.length === 1) return turns[0];
  const lv = LEVELS[level] || LEVELS.expert;
  const o = other(p);
  const scored = turns.map((t) => {
    if (t.pos.off[p] === 15) return { t, v: 1e7 };
    return { t, v: evaluate(t.pos, p, o) + (lv.noise ? gauss() * lv.noise : 0) };
  });
  scored.sort((a, b) => b.v - a.v);
  if (lv.ply < 2 || scored[0].v >= 1e6) return scored[0].t;

  let best = scored[0], bestV = -Infinity;
  for (const c of scored.slice(0, lv.top)) {
    let tot = 0;
    for (const r of ROLLS) {
      const replies = generateTurns(c.t.pos, o, r.dice);
      let val;
      if (!replies.length) val = evaluate(c.t.pos, p, p);
      else {
        const arr = replies.map((t) => ({ t, q: t.pos.off[o] === 15 ? 1e9 : quickEval(t.pos, o) }));
        arr.sort((a, b) => b.q - a.q);
        val = Infinity;
        for (const x of arr.slice(0, 3)) {
          const v = x.t.pos.off[o] === 15 ? -1e5 : evaluate(x.t.pos, p, p);
          if (v < val) val = v;
        }
      }
      tot += r.w * val;
    }
    if (tot > bestV) { bestV = tot; best = c; }
  }
  return best.t;
};

export const aiShouldDouble = (pos, p, level) => {
  const lv = LEVELS[level] || LEVELS.expert;
  const wp = winProb(pos, p, p);
  if (!hasContact(pos)) return wp >= Math.max(0.72, lv.doubleMin);
  return wp >= lv.doubleMin && wp <= 0.87;
};
export const aiShouldTake = (pos, ai, doubler, level) => {
  const lv = LEVELS[level] || LEVELS.expert;
  return winProb(pos, ai, doubler) >= lv.takeMin;
};

/* =====================================================================
   GAME STATE (reducer)
   ===================================================================== */
const ptNo = (i, p) => (p === P1 ? i + 1 : 24 - i);
export const fmtMove = (m, p) =>
  `${m.from === 'bar' ? 'bar' : ptNo(m.from, p)}/${m.to === 'off' ? 'off' : ptNo(m.to, p)}${m.hit ? '*' : ''}`;
const rollText = (roll) => (roll.length === 4 ? `${roll[0]}-${roll[0]}` : roll.join('-'));

const freshGame = () => ({
  pos: initialPosition(), turn: P1, dice: [], roll: [], phase: 'opening', openRoll: null, tie: false,
  cube: { value: 1, owner: 0 }, doubler: 0,
  undo: [], turnMoves: [], log: [], turnId: 0, result: null,
});
const newMatchState = (target) => ({
  match: { target, score: [0, 0, 0], crawford: false, crawfordUsed: false, gameNo: 1, over: false, winner: 0 },
  g: freshGame(),
});

const canDoubleNow = (state, p) => {
  const { g, match } = state;
  return g.phase === 'roll' && g.turn === p && match.target > 1 && !match.crawford && g.cube.value < 64 &&
    (g.cube.owner === 0 || g.cube.owner === p) && match.score[p] + g.cube.value < match.target;
};

const finish = (state, g, winner, mult, reason) => {
  const { match } = state;
  const points = g.cube.value * mult;
  const score = match.score.slice();
  score[winner] += points;
  const over = score[winner] >= match.target;
  let crawford = false, crawfordUsed = match.crawfordUsed;
  if (!over && !crawfordUsed && match.target > 1 && (score[1] === match.target - 1 || score[2] === match.target - 1)) {
    crawford = true; crawfordUsed = true;
  }
  return {
    ...state,
    match: { ...match, score, over, winner: over ? winner : 0, crawford, crawfordUsed },
    g: { ...g, phase: 'over', dice: [], undo: [], result: { winner, mult, points, reason } },
  };
};

const reducer = (state, a) => {
  const { g, match } = state;
  switch (a.type) {
    case 'NEW_MATCH': return newMatchState(a.target);
    case 'NEXT_GAME': return { ...state, match: { ...match, gameNo: match.gameNo + 1 }, g: freshGame() };
    case 'OPENING': {
      if (g.phase !== 'opening') return state;
      const [x, y] = a.dice;
      if (x === y) return { ...state, g: { ...g, openRoll: [x, y], tie: true } };
      return { ...state, g: { ...g, turn: x > y ? P1 : P2, dice: [x, y], roll: [x, y], openRoll: [x, y], tie: false,
        phase: 'move', turnId: g.turnId + 1, undo: [], turnMoves: [] } };
    }
    case 'ROLL': {
      if (g.phase !== 'roll') return state;
      const [x, y] = a.dice;
      const d = x === y ? [x, x, x, x] : [x, y];
      return { ...state, g: { ...g, dice: d, roll: d.slice(), phase: 'move', undo: [], turnMoves: [], turnId: g.turnId + 1 } };
    }
    case 'MOVE': {
      if (g.phase !== 'move') return state;
      const p = g.turn, m = a.move;
      if (g.dice.indexOf(m.die) < 0) return state;
      const pos = applyMove(g.pos, m, p);
      const dice = removeOne(g.dice, m.die);
      const turnMoves = [...g.turnMoves, fmtMove(m, p)];
      const ng = { ...g, pos, dice, turnMoves, undo: [...g.undo, { pos: g.pos, dice: g.dice, turnMoves: g.turnMoves }] };
      if (pos.off[p] === 15) {
        ng.log = [...g.log, { player: p, text: `${rollText(g.roll)}: ${turnMoves.join(' ')}` }];
        return finish(state, ng, p, winMultiplier(pos, p), 'bearoff');
      }
      return { ...state, g: ng };
    }
    case 'UNDO': {
      if (g.phase !== 'move' || !g.undo.length) return state;
      const last = g.undo[g.undo.length - 1];
      return { ...state, g: { ...g, pos: last.pos, dice: last.dice, turnMoves: last.turnMoves, undo: g.undo.slice(0, -1) } };
    }
    case 'END_TURN': {
      if (g.phase !== 'move') return state;
      const text = g.turnMoves.length ? `${rollText(g.roll)}: ${g.turnMoves.join(' ')}` : `${rollText(g.roll)}: no legal move`;
      return { ...state, g: { ...g, turn: other(g.turn), dice: [], roll: [], phase: 'roll', undo: [], turnMoves: [],
        log: [...g.log, { player: g.turn, text }] } };
    }
    case 'DOUBLE': {
      if (!canDoubleNow(state, g.turn)) return state;
      return { ...state, g: { ...g, phase: 'cubeResponse', doubler: g.turn } };
    }
    case 'TAKE': {
      if (g.phase !== 'cubeResponse') return state;
      const responder = other(g.doubler);
      const v = g.cube.value * 2;
      return { ...state, g: { ...g, cube: { value: v, owner: responder }, phase: 'roll', doubler: 0,
        log: [...g.log, { player: g.doubler, text: `doubles to ${v} — takes` }] } };
    }
    case 'PASS': {
      if (g.phase !== 'cubeResponse') return state;
      const ng = { ...g, log: [...g.log, { player: g.doubler, text: `doubles — passed` }] };
      return finish(state, ng, g.doubler, 1, 'pass');
    }
    case 'RESIGN': {
      if (g.phase === 'over') return state;
      return finish(state, g, other(a.player), 1, 'resign');
    }
    default: return state;
  }
};

/* =====================================================================
   HOOKS / HELPERS
   ===================================================================== */
const DEFAULT_SETTINGS = { mode: 'ai', level: 'expert', target: 5, sound: true, autoForced: true, numbers: false, analysis: false };
const loadSettings = () => {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem('bgMasterSettings') || '{}') }; }
  catch { return DEFAULT_SETTINGS; }
};
const rand6 = () => {
  try { const x = new Uint32Array(1); crypto.getRandomValues(x); return Math.floor((x[0] / 4294967296) * 6) + 1; }
  catch { return Math.floor(Math.random() * 6) + 1; }
};

const useSound = (enabled) => {
  const ctxRef = useRef(null);
  const en = useRef(enabled);
  en.current = enabled;
  const tone = useCallback((type, freq, dur, vol, sweep = false, delay = 0) => {
    if (!en.current) return;
    try {
      if (!ctxRef.current) ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = ctxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const t0 = ctx.currentTime + delay;
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (sweep) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq / 4), t0 + dur);
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(t0); osc.stop(t0 + dur);
    } catch { /* audio unavailable */ }
  }, []);
  return useMemo(() => ({
    roll: () => { for (let i = 0; i < 7; i++) tone('square', 200 + Math.random() * 200, 0.05, 0.05, false, i * 0.05); },
    click: () => tone('sine', 600, 0.1, 0.1),
    hit: () => tone('square', 110, 0.22, 0.2, true),
    off: () => tone('triangle', 420, 0.15, 0.12),
    error: () => tone('sawtooth', 150, 0.25, 0.08),
    cube: () => { tone('triangle', 330, 0.12, 0.14); tone('triangle', 495, 0.18, 0.14, false, 0.12); },
    win: () => { tone('sine', 400, 0.2, 0.2); tone('sine', 500, 0.2, 0.2, false, 0.2); tone('sine', 600, 0.45, 0.2, false, 0.4); },
  }), [tone]);
};

const usedFlags = (roll, remaining) => {
  let rem = remaining.slice();
  return roll.map((d) => {
    const i = rem.indexOf(d);
    if (i >= 0) { rem = rem.slice(0, i).concat(rem.slice(i + 1)); return false; }
    return true;
  });
};

/* =====================================================================
   COMPONENTS
   ===================================================================== */
const Checker = React.memo(({ player, i, n, selected, playable, hint }) => (
  <div
    className={`checker p${player}${selected ? ' selected' : ''}${playable ? ' playable' : ''}${hint ? ' hint' : ''}`}
    style={{ '--i': i, zIndex: selected ? 100 : undefined }}
  >
    {n > 5 && i === n - 1 && <span className="badge">{n}</span>}
  </div>
));

const Stack = ({ player, n, anchor, selected, playable, hint }) => (
  <div className={`stack at-${anchor}`} style={{ '--n': n }}>
    {Array.from({ length: n }, (_, i) => (
      <Checker key={i} player={player} i={i} n={n}
        selected={selected && i === n - 1}
        playable={playable && i === n - 1 && !selected}
        hint={hint && i === n - 1} />
    ))}
  </div>
);

const Point = React.memo(({ idx, top, v, label, high, hintTo, origin, selected, hintFrom, onClick }) => {
  const n = Math.abs(v);
  const player = v > 0 ? P1 : P2;
  return (
    <div className={`point ${top ? 'top-row' : 'bottom-row'}${high ? ' highlight' : ''}${hintTo ? ' hint-to' : ''}`}
         onClick={() => onClick(idx)}>
      {label !== null && <span className="plabel">{label}</span>}
      {n > 0 && <Stack player={player} n={n} anchor={top ? 'top' : 'bottom'} selected={selected} playable={origin} hint={hintFrom} />}
    </div>
  );
});

const BarSlot = ({ player, n, selected, playable, hint, onClick }) => (
  <div className="bar-slot" onClick={() => onClick(player)}>
    {n > 0 && <Stack player={player} n={n} anchor={player === P1 ? 'bottom' : 'top'} selected={selected} playable={playable} hint={hint} />}
  </div>
);

const OffTray = ({ player, count, highlight, onClick }) => (
  <div className={`home-slot${highlight ? ' highlight' : ''} ${player === P2 ? 'tray-top' : 'tray-bottom'}`} onClick={() => onClick(player)}>
    <div className="off-pills">
      {Array.from({ length: count }, (_, i) => <span key={i} className={`pill p${player}`} />)}
    </div>
    <div className="off-count">{count}</div>
  </div>
);

const Die = ({ value, used, rolling }) => (
  <div className={`die${rolling ? ' rolling' : ''}${used ? ' used' : ''}`} data-val={value || 0}>
    {Array.from({ length: 9 }, (_, i) => <span key={i} className="dot" />)}
  </div>
);

const Cube = ({ value, owner, active, onClick }) => (
  <div className={`cube owner-${owner}${active ? ' active' : ''}`} onClick={onClick} title={active ? 'Click to double' : 'Doubling cube'}>
    {owner === 0 ? 64 : value}
  </div>
);

/* =====================================================================
   APP
   ===================================================================== */
const App = () => {
  const [settings, setSettings] = useState(loadSettings);
  const [state, dispatch] = useReducer(reducer, null, () => newMatchState(loadSettings().target));
  const [setupOpen, setSetupOpen] = useState(true);
  const [draft, setDraft] = useState(settings);

  const [selected, setSelected] = useState(null);   // number | 'bar'
  const [notification, setNotification] = useState(null);
  const [rolling, setRolling] = useState(false);
  const [tumble, setTumble] = useState([1, 1]);
  const [hint, setHint] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  const { g, match } = state;
  const sfx = useSound(settings.sound);

  const S = useRef(state); S.current = state;
  const settingsRef = useRef(settings); settingsRef.current = settings;
  const rollingRef = useRef(false);
  const busyRef = useRef(false);
  const planRef = useRef(null);
  const notifTimer = useRef(null);
  const logRef = useRef(null);

  const aiMode = settings.mode === 'ai';
  const aiTurn = aiMode && g.turn === P2;
  const viewer = aiMode ? P1 : g.turn;

  const name = useCallback((p) => (aiMode
    ? (p === P1 ? 'You (White)' : `${LEVELS[settings.level].label} AI (Black)`)
    : (p === P1 ? 'Player 1 (White)' : 'Player 2 (Black)')), [aiMode, settings.level]);
  const short = useCallback((p) => (aiMode ? (p === P1 ? 'You' : 'AI') : (p === P1 ? 'White' : 'Black')), [aiMode]);

  const notify = useCallback((msg, ms = 2000) => {
    setNotification(msg);
    clearTimeout(notifTimer.current);
    notifTimer.current = setTimeout(() => setNotification(null), ms);
  }, []);

  /* ---------- derived ---------- */
  const legal = useMemo(
    () => (g.phase === 'move' && g.dice.length ? firstMoves(g.pos, g.turn, g.dice) : []),
    [g.phase, g.pos, g.dice, g.turn]);
  const legalRef = useRef(legal); legalRef.current = legal;

  const humanCanMove = g.phase === 'move' && !aiTurn && !setupOpen;
  const origins = useMemo(() => new Set(legal.map((m) => m.from)), [legal]);
  const targets = useMemo(
    () => (selected === null || !humanCanMove ? new Map() : reachable(g.pos, g.turn, g.dice, selected)),
    [selected, humanCanMove, g.pos, g.turn, g.dice]);

  const cubeEnabled = match.target > 1;
  const canDouble = !aiTurn && !setupOpen && canDoubleNow(state, g.turn);
  const canRoll = !setupOpen && !rolling && ((g.phase === 'roll' && !aiTurn) || g.phase === 'opening');
  const canUndo = humanCanMove && g.undo.length > 0;
  const responder = g.phase === 'cubeResponse' ? other(g.doubler) : 0;
  const humanResponds = responder !== 0 && !(aiMode && responder === P2);

  const pip1 = pipCount(g.pos, P1), pip2 = pipCount(g.pos, P2);
  const winP1 = useMemo(() => (settings.analysis ? winProb(g.pos, P1, g.turn) : 0.5), [settings.analysis, g.pos, g.turn]);

  /* ---------- actions ---------- */
  const doMove = useCallback((m) => {
    if (m.hit) sfx.hit(); else if (m.to === 'off') sfx.off(); else sfx.click();
    dispatch({ type: 'MOVE', move: m });
  }, [sfx]);

  const rollDice = useCallback(() => {
    const ph = S.current.g.phase;
    if (rollingRef.current || (ph !== 'roll' && ph !== 'opening')) return;
    rollingRef.current = true; setRolling(true); setHint(null); sfx.roll();
    const iv = setInterval(() => setTumble([rand6(), rand6()]), 70);
    setTimeout(() => {
      clearInterval(iv);
      rollingRef.current = false; setRolling(false);
      const x = rand6(), y = rand6();
      if (S.current.g.phase === 'opening') {
        dispatch({ type: 'OPENING', dice: [x, y] });
        if (x === y) notify('Tie — roll again');
      } else {
        dispatch({ type: 'ROLL', dice: [x, y] });
        if (x === y) notify('Doubles!');
      }
    }, 520);
  }, [sfx, notify]);

  const playPath = useCallback((path) => {
    busyRef.current = true;
    setSelected(null); setHint(null);
    path.forEach((m, i) => setTimeout(() => {
      doMove(m);
      if (i === path.length - 1) busyRef.current = false;
    }, i * 260));
  }, [doMove]);

  const handlePoint = useCallback((idx) => {
    if (!humanCanMove || busyRef.current) return;
    if (selected !== null && targets.has(idx)) { playPath(targets.get(idx)); return; }
    if (origins.has(idx)) { sfx.click(); setSelected((s) => (s === idx ? null : idx)); return; }
    const mine = g.pos.pts[idx] !== 0 && (g.turn === P1 ? g.pos.pts[idx] > 0 : g.pos.pts[idx] < 0);
    if (mine) {
      sfx.error();
      notify(g.pos.bar[g.turn] > 0 ? 'Enter your checker from the bar first' : 'That checker has no legal move');
    }
    setSelected(null);
  }, [humanCanMove, selected, targets, origins, playPath, g.pos, g.turn, sfx, notify]);

  const handleBar = useCallback((player) => {
    if (!humanCanMove || busyRef.current || player !== g.turn || g.pos.bar[player] === 0) return;
    if (origins.has('bar')) { sfx.click(); setSelected((s) => (s === 'bar' ? null : 'bar')); }
    else { sfx.error(); notify('No legal entry with these dice'); }
  }, [humanCanMove, g.turn, g.pos.bar, origins, sfx, notify]);

  const handleOff = useCallback((player) => {
    if (!humanCanMove || busyRef.current || player !== g.turn || selected === null) return;
    if (targets.has('off')) playPath(targets.get('off'));
  }, [humanCanMove, g.turn, selected, targets, playPath]);

  const handleUndo = useCallback(() => {
    if (!canUndo || busyRef.current) return;
    sfx.click(); setSelected(null); setHint(null);
    dispatch({ type: 'UNDO' });
  }, [canUndo, sfx]);

  const handleDouble = useCallback(() => {
    if (!canDouble) return;
    sfx.cube(); setHint(null);
    dispatch({ type: 'DOUBLE' });
  }, [canDouble, sfx]);

  const requestHint = useCallback(() => {
    if (!humanCanMove || !legal.length || analyzing) return;
    setAnalyzing(true);
    setTimeout(() => {
      const st = S.current.g;
      const best = chooseTurn(st.pos, st.turn, st.dice, 'master');
      setHint(best ? { moves: best.moves, text: best.moves.map((m) => fmtMove(m, st.turn)).join('   ') } : null);
      setAnalyzing(false);
    }, 40);
  }, [humanCanMove, legal.length, analyzing]);

  const startMatch = () => {
    setSettings(draft);
    settingsRef.current = draft;
    try { localStorage.setItem('bgMasterSettings', JSON.stringify(draft)); } catch { /* ignore */ }
    planRef.current = null; setSelected(null); setHint(null);
    dispatch({ type: 'NEW_MATCH', target: draft.target });
    setSetupOpen(false);
  };

  const updateSetting = (k, v) => {
    const next = { ...settings, [k]: v };
    setSettings(next); setDraft(next);
    try { localStorage.setItem('bgMasterSettings', JSON.stringify(next)); } catch { /* ignore */ }
  };

  /* ---------- effects ---------- */
  // clear selection/hint whenever the position or turn changes
  useEffect(() => { setSelected(null); setHint(null); }, [g.pos, g.turn, g.phase]);

  // auto-scroll log
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [g.log.length]);

  // win sound
  useEffect(() => { if (g.phase === 'over') sfx.win(); }, [g.phase]); // eslint-disable-line

  // end of turn / no legal moves
  useEffect(() => {
    if (setupOpen || g.phase !== 'move') return;
    const done = g.dice.length === 0;
    if (!done && legal.length > 0) return;
    if (!done) notify(g.turnMoves.length ? 'No more legal moves' : 'No legal moves', 1400);
    const t = setTimeout(() => dispatch({ type: 'END_TURN' }), done ? (aiTurn ? 500 : 900) : 1500);
    return () => clearTimeout(t);
  }, [setupOpen, g.phase, g.dice, legal, aiTurn]); // eslint-disable-line

  // AI: roll or double
  useEffect(() => {
    if (setupOpen || !aiTurn || g.phase !== 'roll') return;
    const t = setTimeout(() => {
      const st = S.current;
      if (canDoubleNow(st, P2) && aiShouldDouble(st.g.pos, P2, settingsRef.current.level)) {
        sfx.cube();
        dispatch({ type: 'DOUBLE' });
      } else rollDice();
    }, 750);
    return () => clearTimeout(t);
  }, [setupOpen, aiTurn, g.phase, g.turnId]); // eslint-disable-line

  // AI: respond to a double
  useEffect(() => {
    if (setupOpen || g.phase !== 'cubeResponse' || !(aiMode && responder === P2)) return;
    const t = setTimeout(() => {
      const st = S.current.g;
      const take = aiShouldTake(st.pos, P2, st.doubler, settingsRef.current.level) ||
        S.current.match.score[st.doubler] + st.cube.value >= S.current.match.target;
      dispatch({ type: take ? 'TAKE' : 'PASS' });
    }, 1000);
    return () => clearTimeout(t);
  }, [setupOpen, g.phase, aiMode, responder]); // eslint-disable-line

  // AI: play its moves
  useEffect(() => {
    if (setupOpen || !aiTurn || g.phase !== 'move' || legal.length === 0) return;
    const hasPlan = planRef.current && planRef.current.turnId === g.turnId && planRef.current.moves.length > 0;
    const t = setTimeout(() => {
      const st = S.current.g;
      const lg = legalRef.current;
      const okFirst = (m) => lg.some((x) => x.from === m.from && x.to === m.to && x.die === m.die);
      let plan = planRef.current;
      if (!plan || plan.turnId !== st.turnId || !plan.moves.length || !okFirst(plan.moves[0])) {
        const best = chooseTurn(st.pos, st.turn, st.dice, settingsRef.current.level);
        plan = { turnId: st.turnId, moves: best ? best.moves.slice() : [] };
      }
      const mv = plan.moves.shift();
      planRef.current = plan;
      if (mv) doMove(mv);
    }, hasPlan ? 480 : 700);
    return () => clearTimeout(t);
  }, [setupOpen, aiTurn, g.phase, g.pos, g.dice, g.turnId, legal]); // eslint-disable-line

  // Human: auto-play forced move
  useEffect(() => {
    if (!settings.autoForced || !humanCanMove || legal.length !== 1 || busyRef.current) return;
    const t = setTimeout(() => { if (!busyRef.current) doMove(legal[0]); }, 750);
    return () => clearTimeout(t);
  }, [settings.autoForced, humanCanMove, legal, doMove]);

  // keyboard
  useEffect(() => {
    const onKey = (e) => {
      if (setupOpen || e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') return;
      const k = e.key.toLowerCase();
      if (k === ' ' || k === 'enter') { if (canRoll) { e.preventDefault(); rollDice(); } }
      else if (k === 'u') handleUndo();
      else if (k === 'h') requestHint();
      else if (k === 'd') handleDouble();
      else if (k === 'escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setupOpen, canRoll, rollDice, handleUndo, requestHint, handleDouble]);

  /* ---------- render helpers ---------- */
  const status = (() => {
    if (setupOpen) return 'Set up a match to begin';
    if (g.phase === 'over') return 'Game over';
    if (g.phase === 'opening') return g.tie ? 'Tie — roll again' : 'Roll to decide who starts';
    if (g.phase === 'cubeResponse') return `${name(g.doubler)} doubles to ${g.cube.value * 2} — ${name(responder)} to respond`;
    if (g.phase === 'roll') return aiTurn ? 'Computer is about to roll…' : `${name(g.turn)} — roll the dice${canDouble ? ' (or double)' : ''}`;
    if (g.dice.length === 0) return 'Turn complete';
    if (legal.length === 0) return 'No legal moves';
    if (aiTurn) return 'Computer is thinking…';
    if (analyzing) return 'Analyzing…';
    if (hint) return `Suggested: ${hint.text}`;
    return `${name(g.turn)} — move (${g.dice.join(' · ')} left)`;
  })();

  const shownDice = rolling ? tumble : (g.phase === 'opening' ? (g.openRoll || []) : g.roll);
  const flags = rolling || g.phase === 'opening' ? [false, false] : usedFlags(g.roll, g.dice);
  const label = (idx) => (settings.numbers ? ptNo(idx, viewer) : null);
  const hm = hint && hint.moves[0];

  const renderPoint = (idx, top) => (
    <Point key={idx} idx={idx} top={top} v={g.pos.pts[idx]} label={label(idx)}
      high={targets.has(idx)} hintTo={!!hm && hm.to === idx}
      origin={humanCanMove && origins.has(idx)} selected={selected === idx}
      hintFrom={!!hm && hm.from === idx} onClick={handlePoint} />
  );

  const cubeEl = cubeEnabled && (
    <div className={`cube-wrap pos-${g.cube.owner}`}>
      <Cube value={g.cube.value} owner={g.cube.owner} active={canDouble} onClick={handleDouble} />
    </div>
  );

  const resultText = g.result && (() => {
    const r = g.result;
    const kind = r.reason === 'pass' ? 'Double declined' : r.reason === 'resign' ? 'Resigned' : r.mult === 3 ? 'Backgammon!' : r.mult === 2 ? 'Gammon!' : 'Single game';
    return `${kind} · ${r.points} point${r.points > 1 ? 's' : ''}`;
  })();

  return (
    <div className="bg-root">
      <style>{CSS}</style>

      {/* ---------- header ---------- */}
      <div className="bg-col header">
        <div className={`pcard${g.turn === P1 && g.phase !== 'over' && g.phase !== 'opening' ? ' active' : ''}`}>
          <span className="pdot p1" />
          <div className="pinfo">
            <div className="pname">{name(P1)}</div>
            <div className="pstats">Pips {pip1} · Off {g.pos.off[1]}</div>
          </div>
          {cubeEnabled && <div className="pscore">{match.score[1]}</div>}
        </div>
        <div className="center-info">
          <div className="match-line">{cubeEnabled ? `Match to ${match.target}` : 'Single game'} · Game {match.gameNo}</div>
          {match.crawford && <div className="tag">Crawford game — no doubling</div>}
        </div>
        <div className={`pcard right${g.turn === P2 && g.phase !== 'over' && g.phase !== 'opening' ? ' active' : ''}`}>
          {cubeEnabled && <div className="pscore">{match.score[2]}</div>}
          <div className="pinfo">
            <div className="pname">{name(P2)}</div>
            <div className="pstats">Pips {pip2} · Off {g.pos.off[2]}</div>
          </div>
          <span className="pdot p2" />
        </div>
      </div>

      <div className="bg-col status">{status}</div>

      {settings.analysis && (
        <div className="bg-col analysis" title="Engine estimate of winning chances">
          <div className="abar"><div className="afill" style={{ width: `${Math.round(winP1 * 100)}%` }} /></div>
          <div className="alabels"><span>White {Math.round(winP1 * 100)}%</span><span>Black {100 - Math.round(winP1 * 100)}%</span></div>
        </div>
      )}

      <div className="bg-layout">
        <div className="bg-col">
          {/* ---------- board ---------- */}
          <div className="game-area">
            <div className="board-wrapper">
              <div className="board-half left-board">
                {[12, 13, 14, 15, 16, 17].map((i) => renderPoint(i, true))}
                {[11, 10, 9, 8, 7, 6].map((i) => renderPoint(i, false))}
              </div>
              <div className="bar">
                <BarSlot player={P1} n={g.pos.bar[1]} selected={selected === 'bar' && g.turn === P1}
                  playable={humanCanMove && g.turn === P1 && origins.has('bar')} hint={!!hm && hm.from === 'bar' && g.turn === P1} onClick={handleBar} />
                <BarSlot player={P2} n={g.pos.bar[2]} selected={selected === 'bar' && g.turn === P2}
                  playable={humanCanMove && g.turn === P2 && origins.has('bar')} hint={!!hm && hm.from === 'bar' && g.turn === P2} onClick={handleBar} />
              </div>
              <div className="board-half right-board">
                {[18, 19, 20, 21, 22, 23].map((i) => renderPoint(i, true))}
                {[5, 4, 3, 2, 1, 0].map((i) => renderPoint(i, false))}
              </div>
            </div>
            <div className="homes">
              <OffTray player={P2} count={g.pos.off[2]} highlight={humanCanMove && g.turn === P2 && selected !== null && targets.has('off')} onClick={handleOff} />
              <OffTray player={P1} count={g.pos.off[1]} highlight={humanCanMove && g.turn === P1 && selected !== null && targets.has('off')} onClick={handleOff} />
              {cubeEl}
            </div>
            <div className={`notification${notification ? ' show-notif' : ''}`}>{notification}</div>
          </div>

          {/* ---------- controls ---------- */}
          <div className="controls">
            <div className="controls-group">
              <button className="btn" onClick={() => { setDraft(settings); setSetupOpen(true); }}>New match</button>
              <button className="btn" onClick={handleUndo} disabled={!canUndo}>Undo</button>
              <button className="btn" onClick={requestHint} disabled={!humanCanMove || !legal.length || analyzing}>Hint</button>
            </div>
            <div className="dice-container">
              <Die value={shownDice[0]} used={!!flags[0]} rolling={rolling} />
              <Die value={shownDice[1]} used={!!flags[1]} rolling={rolling} />
              {g.roll.length === 4 && !rolling && (
                <>
                  <Die value={g.roll[2]} used={!!flags[2]} />
                  <Die value={g.roll[3]} used={!!flags[3]} />
                </>
              )}
            </div>
            <div className="controls-group">
              <button className={`btn primary${canRoll ? ' pulse' : ''}`} onClick={rollDice} disabled={!canRoll}>
                {g.phase === 'opening' ? 'Roll to start' : 'Roll'}
              </button>
              {cubeEnabled && <button className="btn" onClick={handleDouble} disabled={!canDouble}>Double</button>}
              <button className="btn danger" onClick={() => { if (g.phase !== 'over' && !setupOpen && window.confirm('Resign this game?')) dispatch({ type: 'RESIGN', player: aiMode ? P1 : g.turn }); }}
                disabled={g.phase === 'over' || setupOpen}>Resign</button>
            </div>
          </div>

          <div className="toggles">
            <button className={`tgl${settings.sound ? ' on' : ''}`} onClick={() => updateSetting('sound', !settings.sound)}>Sound</button>
            <button className={`tgl${settings.autoForced ? ' on' : ''}`} onClick={() => updateSetting('autoForced', !settings.autoForced)}>Auto-play forced moves</button>
            <button className={`tgl${settings.numbers ? ' on' : ''}`} onClick={() => updateSetting('numbers', !settings.numbers)}>Point numbers</button>
            <button className={`tgl${settings.analysis ? ' on' : ''}`} onClick={() => updateSetting('analysis', !settings.analysis)}>Win-chance bar</button>
            <span className="keys">Keys: Space roll · U undo · H hint · D double · Esc deselect</span>
          </div>
        </div>

        {/* ---------- side panel ---------- */}
        <div className="side">
          <div className="side-title">Move log</div>
          <div className="log" ref={logRef}>
            {g.log.length === 0 && <div className="log-empty">No moves yet</div>}
            {g.log.map((e, i) => (
              <div key={i} className={`log-row p${e.player}`}>
                <span className="who">{short(e.player)}</span>
                <span className="txt">{e.text}</span>
              </div>
            ))}
          </div>
          <div className="side-note">
            Notation is from the mover's own view (24 = their back point). * marks a hit.
          </div>
        </div>
      </div>

      {/* ---------- modals ---------- */}
      {setupOpen && (
        <div className="modal">
          <div className="modal-content setup">
            <h1>Backgammon</h1>
            <div className="field">
              <label>Opponent</label>
              <select value={draft.mode} onChange={(e) => setDraft({ ...draft, mode: e.target.value })}>
                <option value="ai">Computer</option>
                <option value="pvp">Two players (same screen)</option>
              </select>
            </div>
            {draft.mode === 'ai' && (
              <div className="field">
                <label>Strength</label>
                <select value={draft.level} onChange={(e) => setDraft({ ...draft, level: e.target.value })}>
                  {Object.entries(LEVELS).map(([k, v]) => <option key={k} value={k}>{v.label} — {v.blurb}</option>)}
                </select>
              </div>
            )}
            <div className="field">
              <label>Match length</label>
              <select value={draft.target} onChange={(e) => setDraft({ ...draft, target: Number(e.target.value) })}>
                <option value={1}>Single game (no cube)</option>
                <option value={3}>3 points</option>
                <option value={5}>5 points</option>
                <option value={7}>7 points</option>
                <option value={9}>9 points</option>
                <option value={11}>11 points</option>
              </select>
            </div>
            <p className="small">Matches use the doubling cube, gammons (×2), backgammons (×3) and the Crawford rule.</p>
            <button className="btn primary" onClick={startMatch}>Start match</button>
          </div>
        </div>
      )}

      {!setupOpen && g.phase === 'cubeResponse' && humanResponds && (
        <div className="modal">
          <div className="modal-content">
            <h1>Double!</h1>
            <p>{name(g.doubler)} offers the cube at <b>{g.cube.value * 2}</b>.<br />
              {name(responder)}: take it, or pass and give up {g.cube.value} point{g.cube.value > 1 ? 's' : ''}?</p>
            {settings.analysis && <p className="small">Engine estimate — your chances: {Math.round(winProb(g.pos, responder, g.doubler) * 100)}%</p>}
            <div className="row">
              <button className="btn primary" onClick={() => { sfx.cube(); dispatch({ type: 'TAKE' }); }}>Take</button>
              <button className="btn danger" onClick={() => dispatch({ type: 'PASS' })}>Pass</button>
            </div>
          </div>
        </div>
      )}

      {!setupOpen && g.phase === 'over' && g.result && (
        <div className="modal">
          <div className="modal-content">
            <h1>{match.over ? `${name(match.winner)} wins the match!` : `${name(g.result.winner)} wins the game`}</h1>
            <p>{resultText}{g.cube.value > 1 && g.result.reason !== 'pass' ? ` (cube ${g.cube.value})` : ''}</p>
            {cubeEnabled && <p className="small">Score — White {match.score[1]} : {match.score[2]} Black (to {match.target})</p>}
            <div className="row">
              {match.over
                ? <button className="btn primary" onClick={() => { setDraft(settings); setSetupOpen(true); }}>New match</button>
                : <button className="btn primary" onClick={() => { planRef.current = null; dispatch({ type: 'NEXT_GAME' }); }}>Next game</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;

/* =====================================================================
   STYLES
   ===================================================================== */
const CSS = `
.bg-root {
  --wood-bg: #1a100c; --wood-board-base: #98653b; --point-dark: #222; --point-light: #e4c59a;
  --checker-p1: #ebdcb9; --checker-p2: #181818;
  --highlight: rgba(100,255,100,0.45); --selected: rgba(255,215,0,0.85); --playable: rgba(100,200,255,0.55); --hint: rgba(255,140,60,0.85);
  --bw: min(96vw, 940px); --bh: min(64vh, 600px);
  --bd: clamp(12px, 2vw, 22px); --bar-w: clamp(30px, 5vw, 52px); --home-w: clamp(46px, 7vw, 84px);
  --pw: calc((var(--bw) - var(--home-w) - 8px - 2 * var(--bd) - var(--bar-w)) / 12);
  --ph: calc((var(--bh) - 2 * var(--bd)) / 2);
  --cs: min(calc(var(--pw) * 0.9), calc(var(--ph) * 0.17));
  min-height: 100vh; padding: 12px 0 28px; display: flex; flex-direction: column; align-items: center; gap: 10px;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #ebdcb9;
  background-color: var(--wood-bg);
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E"), radial-gradient(circle at center, #2e1d15 0%, #110906 100%);
}
.bg-root *, .bg-root *::before, .bg-root *::after { box-sizing: border-box; margin: 0; padding: 0; user-select: none; }
.bg-col { width: var(--bw); }
.bg-layout { display: flex; gap: 16px; align-items: flex-start; justify-content: center; flex-wrap: wrap; width: 100%; }

/* header */
.header { display: flex; justify-content: space-between; align-items: stretch; gap: 10px; }
.pcard { flex: 1; display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: linear-gradient(to bottom,#3d2314,#241208); border: 2px solid #5a351d; border-radius: 8px; transition: box-shadow .25s, border-color .25s; min-width: 0; }
.pcard.right { flex-direction: row; justify-content: flex-end; text-align: right; }
.pcard.active { border-color: #e4c59a; box-shadow: 0 0 14px rgba(228,197,154,.45); }
.pdot { width: 18px; height: 18px; border-radius: 50%; flex: none; box-shadow: inset 0 -2px 3px rgba(0,0,0,.6), 0 1px 3px rgba(0,0,0,.8); }
.pdot.p1 { background: var(--checker-p1); } .pdot.p2 { background: var(--checker-p2); border: 1px solid #777; }
.pinfo { min-width: 0; } .pname { font-weight: 700; font-size: .95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pstats { font-size: .78rem; opacity: .75; }
.pscore { font-size: 1.7rem; font-weight: 800; padding: 0 8px; color: #e4c59a; text-shadow: 0 2px 4px rgba(0,0,0,.8); }
.center-info { display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; min-width: 110px; }
.match-line { font-size: .85rem; font-weight: 700; letter-spacing: .5px; text-transform: uppercase; color: #e4c59a; }
.tag { margin-top: 4px; font-size: .7rem; background: #5a351d; padding: 2px 8px; border-radius: 10px; }
.status { text-align: center; font-size: 1.05rem; font-weight: 600; min-height: 1.6em; color: #e4c59a; text-shadow: 0 2px 4px rgba(0,0,0,.8); }
.analysis .abar { height: 10px; border-radius: 5px; background: #181818; border: 1px solid #5a351d; overflow: hidden; }
.analysis .afill { height: 100%; background: linear-gradient(90deg,#ebdcb9,#c9b182); transition: width .4s; }
.analysis .alabels { display: flex; justify-content: space-between; font-size: .75rem; opacity: .8; margin-top: 2px; }

/* board */
.game-area { position: relative; display: flex; gap: 8px; width: var(--bw); box-shadow: 0 25px 50px rgba(0,0,0,.9); border-radius: 8px; }
.board-wrapper { position: relative; flex: 1; min-width: 0; height: var(--bh); background-color: var(--wood-board-base);
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.4' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.08'/%3E%3C/svg%3E"), repeating-linear-gradient(90deg, transparent 0, transparent 40px, rgba(0,0,0,.03) 40px, rgba(0,0,0,.03) 80px), linear-gradient(135deg, rgba(255,255,255,.08) 0%, rgba(0,0,0,.3) 100%);
  border: var(--bd) solid; border-color: #5c3522 #2e160b #1a0b05 #4a2918; border-radius: 10px;
  box-shadow: inset 0 0 40px rgba(0,0,0,.8), 0 15px 35px rgba(0,0,0,.6); display: flex; }
.board-half { flex: 1; display: grid; grid-template-columns: repeat(6, 1fr); grid-template-rows: 50% 50%; position: relative; box-shadow: inset 0 0 25px rgba(0,0,0,.4); }
.bar { width: var(--bar-w); background: #4a2d1a; border-left: 3px solid #2b180d; border-right: 3px solid #2b180d; box-shadow: inset 0 0 15px rgba(0,0,0,.8), 0 0 15px rgba(0,0,0,.6); display: flex; flex-direction: column; z-index: 10; position: relative; }
.bar-slot { flex: 1; position: relative; cursor: pointer; }

.point { position: relative; cursor: pointer; }
.point::before { content: ''; position: absolute; left: 0; right: 0; height: 90%; filter: drop-shadow(1px 2px 2px rgba(0,0,0,.3)); z-index: 0; }
.top-row.point::before { top: 0; clip-path: polygon(0 0, 100% 0, 50% 100%); }
.bottom-row.point::before { bottom: 0; clip-path: polygon(50% 0, 0 100%, 100% 100%); }
.point:nth-child(even)::before { background-color: var(--point-dark); }
.point:nth-child(odd)::before { background-color: var(--point-light); }
.right-board .point:nth-child(even)::before { background-color: var(--point-light); }
.right-board .point:nth-child(odd)::before { background-color: var(--point-dark); }
.point.highlight::after, .point.hint-to::after, .home-slot.highlight::after { content: ''; position: absolute; left: 0; right: 0; pointer-events: none; z-index: 5; animation: pulseGlow 1.2s infinite alternate; }
.point.highlight::after { background: var(--highlight); }
.point.hint-to::after { background: var(--hint); }
.top-row.highlight::after, .top-row.hint-to::after { top: 0; height: 90%; clip-path: polygon(0 0, 100% 0, 50% 100%); }
.bottom-row.highlight::after, .bottom-row.hint-to::after { bottom: 0; height: 90%; clip-path: polygon(50% 0, 0 100%, 100% 100%); }
@keyframes pulseGlow { from { opacity: .35; } to { opacity: .85; } }
.plabel { position: absolute; left: 0; right: 0; text-align: center; font-size: clamp(8px, 1.1vw, 11px); font-weight: 700; color: #e4c59a; opacity: .85; pointer-events: none; }
.top-row .plabel { top: calc(var(--bd) * -0.8); } .bottom-row .plabel { bottom: calc(var(--bd) * -0.8); }

/* checkers (absolute stacks that auto-compress for tall piles) */
.stack { position: absolute; inset: 0; z-index: 10; --step: min(var(--cs), calc((var(--ph) - var(--cs)) / max(calc(var(--n) - 1), 1))); }
.stack .checker { position: absolute; left: calc(50% - var(--cs) / 2); }
.stack.at-top .checker { top: calc(var(--i) * var(--step)); }
.stack.at-bottom .checker { bottom: calc(var(--i) * var(--step)); }
.checker { width: var(--cs); height: var(--cs); border-radius: 50%; display: flex; align-items: center; justify-content: center;
  box-shadow: 2px 5px 8px rgba(0,0,0,.6), inset 0 2px 4px rgba(255,255,255,.4), inset 0 -3px 5px rgba(0,0,0,.5); transition: transform .2s cubic-bezier(.34,1.56,.64,1), box-shadow .2s; }
.checker::after { content: ''; position: absolute; top: 4%; left: 10%; width: 80%; height: 35%; background: linear-gradient(to bottom, rgba(255,255,255,.15), transparent); border-radius: 50% 50% 0 0; pointer-events: none; }
.checker.p1 { background-color: var(--checker-p1); background-image: repeating-radial-gradient(circle at center, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 8%, rgba(120,75,30,.4) 10%, rgba(255,255,255,.5) 12%, rgba(0,0,0,0) 14%); border: 2px solid #a38962; }
.checker.p2 { background-color: var(--checker-p2); background-image: repeating-radial-gradient(circle at center, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 8%, rgba(0,0,0,.95) 10%, rgba(255,255,255,.2) 12%, rgba(0,0,0,0) 14%); border: 2px solid #000; }
.checker.playable { animation: playablePulse 2s infinite; cursor: pointer; }
@keyframes playablePulse { 0%,100% { box-shadow: 2px 5px 8px rgba(0,0,0,.6), 0 0 0 0 var(--playable); } 50% { box-shadow: 2px 5px 8px rgba(0,0,0,.6), 0 0 12px 6px var(--playable); } }
.checker.hint { box-shadow: 2px 5px 8px rgba(0,0,0,.6), 0 0 14px 6px var(--hint) !important; }
.checker.selected { box-shadow: 0 15px 25px rgba(0,0,0,.8), 0 0 15px 5px var(--selected) !important; transform: scale(1.06); }
.checker .badge { position: absolute; top: -4px; right: -4px; background: #2b180d; color: #ebdcb9; border-radius: 50%; width: 20px; height: 20px; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; border: 1px solid #ebdcb9; z-index: 10; }

/* homes / off trays / cube */
.homes { position: relative; width: var(--home-w); height: var(--bh); background: #2b180d; border: var(--bd) solid #4a2d1a; border-left-width: 5px; border-radius: 0 8px 8px 0; display: flex; flex-direction: column; box-shadow: inset 0 0 30px rgba(0,0,0,.9); }
.home-slot { flex: 1; position: relative; border-bottom: 3px solid #150a04; cursor: pointer; overflow: hidden; }
.home-slot:last-of-type { border-bottom: none; }
.home-slot.highlight::after { top: 0; bottom: 0; background: var(--highlight); border-radius: 4px; }
.off-pills { position: absolute; left: 50%; transform: translateX(-50%); width: 80%; display: flex; flex-direction: column; gap: 1px; }
.tray-top .off-pills { top: 3px; } .tray-bottom .off-pills { bottom: 3px; flex-direction: column-reverse; }
.pill { display: block; width: 100%; height: calc(var(--ph) * 0.052); border-radius: 3px; box-shadow: 0 1px 2px rgba(0,0,0,.7), inset 0 1px 1px rgba(255,255,255,.3); }
.pill.p1 { background: var(--checker-p1); border: 1px solid #a38962; } .pill.p2 { background: #222; border: 1px solid #000; }
.off-count { position: absolute; top: 50%; left: 0; right: 0; transform: translateY(-50%); text-align: center; font-size: 1.8rem; font-weight: 800; color: rgba(255,255,255,.10); pointer-events: none; }
.cube-wrap { position: absolute; left: 50%; transform: translate(-50%, -50%); z-index: 20; }
.cube-wrap.pos-0 { top: 50%; } .cube-wrap.pos-2 { top: calc(var(--ph) * 0.97); } .cube-wrap.pos-1 { top: calc(100% - var(--ph) * 0.97); }
.cube-wrap.pos-2 { top: 28px; } .cube-wrap.pos-1 { top: calc(100% - 28px); }
.cube { width: calc(var(--home-w) * 0.56); height: calc(var(--home-w) * 0.56); min-width: 28px; min-height: 28px; border-radius: 7px; background: linear-gradient(145deg,#fffdf2,#d9cfae); color: #3d2314; font-weight: 800; font-size: clamp(.8rem, 1.7vw, 1.25rem); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 8px rgba(0,0,0,.7), inset 0 -3px 4px rgba(0,0,0,.2); border: 1px solid #8b7b55; }
.cube.active { cursor: pointer; animation: cubePulse 1.4s infinite; }
@keyframes cubePulse { 0%,100% { box-shadow: 0 4px 8px rgba(0,0,0,.7), 0 0 0 0 rgba(255,215,0,.6); } 50% { box-shadow: 0 4px 8px rgba(0,0,0,.7), 0 0 14px 6px rgba(255,215,0,.6); } }

/* controls */
.controls { width: var(--bw); background: rgba(30,18,10,.8); padding: 12px 18px; margin-top: 14px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; border: 1px solid #4a2d1a; box-shadow: 0 5px 15px rgba(0,0,0,.5); }
.controls-group { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.dice-container { display: flex; gap: 10px; align-items: center; min-width: 120px; justify-content: center; }
.die { width: 50px; height: 50px; background-color: #fffff4; background-image: radial-gradient(circle at 30% 30%, #fff, #e3dac9); border-radius: 10px; box-shadow: inset -2px -2px 8px rgba(0,0,0,.3), inset 2px 2px 8px #fff, 0 6px 12px rgba(0,0,0,.6); display: grid; grid-template-columns: repeat(3,1fr); grid-template-rows: repeat(3,1fr); padding: 7px; gap: 3px; transition: transform .3s ease-out, opacity .3s; border: 1px solid #a89980; }
.die.rolling { animation: rollDie .4s linear infinite; }
@keyframes rollDie { 0% { transform: rotate(0) scale(1); } 25% { transform: rotate(90deg) scale(1.1) translateY(-8px); } 50% { transform: rotate(180deg) scale(1); } 75% { transform: rotate(270deg) scale(1.1) translateY(-8px); } 100% { transform: rotate(360deg) scale(1); } }
.dot { background: #111; border-radius: 50%; width: 10px; height: 10px; place-self: center; visibility: hidden; box-shadow: inset 0 2px 3px rgba(0,0,0,.8); }
.die[data-val="1"] .dot:nth-child(5),
.die[data-val="2"] .dot:nth-child(3), .die[data-val="2"] .dot:nth-child(7),
.die[data-val="3"] .dot:nth-child(3), .die[data-val="3"] .dot:nth-child(5), .die[data-val="3"] .dot:nth-child(7),
.die[data-val="4"] .dot:nth-child(1), .die[data-val="4"] .dot:nth-child(3), .die[data-val="4"] .dot:nth-child(7), .die[data-val="4"] .dot:nth-child(9),
.die[data-val="5"] .dot:nth-child(1), .die[data-val="5"] .dot:nth-child(3), .die[data-val="5"] .dot:nth-child(5), .die[data-val="5"] .dot:nth-child(7), .die[data-val="5"] .dot:nth-child(9),
.die[data-val="6"] .dot:nth-child(1), .die[data-val="6"] .dot:nth-child(3), .die[data-val="6"] .dot:nth-child(4), .die[data-val="6"] .dot:nth-child(6), .die[data-val="6"] .dot:nth-child(7), .die[data-val="6"] .dot:nth-child(9) { visibility: visible; }
.die[data-val="0"] { opacity: .25; }
.die.used { opacity: .3; transform: scale(.88); }
.btn { padding: 9px 16px; font-size: .9rem; font-weight: 700; color: #ebdcb9; background: #3d2314; border: 1px solid #5a351d; border-radius: 6px; cursor: pointer; box-shadow: 0 4px 8px rgba(0,0,0,.5); text-transform: uppercase; letter-spacing: 1px; transition: all .15s ease; }
.btn:hover:not(:disabled) { background: #4a2d1a; transform: translateY(-1px); }
.btn:active:not(:disabled) { transform: translateY(1px); box-shadow: 0 1px 2px rgba(0,0,0,.6); }
.btn:disabled { background: #1a0f08; border-color: #110905; color: #555; cursor: not-allowed; box-shadow: none; }
.btn.primary { background: linear-gradient(to bottom,#7a4a22,#55300f); border-color: #c9a063; }
.btn.danger { background: #4a1a14; border-color: #7a2e24; }
.btn.pulse { animation: btnPulse 1.4s infinite; }
@keyframes btnPulse { 0%,100% { box-shadow: 0 4px 8px rgba(0,0,0,.5), 0 0 0 0 rgba(228,197,154,.6); } 50% { box-shadow: 0 4px 8px rgba(0,0,0,.5), 0 0 14px 5px rgba(228,197,154,.6); } }
.toggles { width: var(--bw); display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 8px; }
.tgl { padding: 5px 10px; font-size: .75rem; color: #aaa; background: #1a0f08; border: 1px solid #3d2314; border-radius: 14px; cursor: pointer; }
.tgl.on { color: #ebdcb9; background: #4a2d1a; border-color: #c9a063; }
.keys { font-size: .7rem; opacity: .55; margin-left: auto; }

/* side panel */
.side { width: min(var(--bw), 290px); background: rgba(30,18,10,.8); border: 1px solid #4a2d1a; border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.side-title { font-weight: 700; text-transform: uppercase; letter-spacing: 1px; font-size: .8rem; color: #e4c59a; }
.log { height: min(var(--bh), 420px); overflow-y: auto; display: flex; flex-direction: column; gap: 3px; font-size: .82rem; font-variant-numeric: tabular-nums; user-select: text; }
.log * { user-select: text; }
.log-empty { opacity: .5; font-style: italic; }
.log-row { display: flex; gap: 8px; padding: 3px 6px; border-radius: 4px; background: rgba(255,255,255,.03); }
.log-row .who { width: 42px; flex: none; font-weight: 700; } .log-row.p1 .who { color: #ebdcb9; } .log-row.p2 .who { color: #999; }
.side-note { font-size: .7rem; opacity: .55; }

/* modals */
.modal { display: flex; position: fixed; inset: 0; background: rgba(0,0,0,.85); z-index: 1000; justify-content: center; align-items: center; backdrop-filter: blur(4px); padding: 12px; }
.modal-content { background: linear-gradient(to bottom,#3d2314,#1a0f08); border: 4px solid #ebdcb9; padding: 30px 34px; border-radius: 10px; text-align: center; box-shadow: 0 0 50px rgba(0,0,0,.8); animation: slideIn .4s ease-out; max-width: 460px; width: 100%; }
.modal-content.setup { text-align: left; }
@keyframes slideIn { from { transform: translateY(-40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
.modal h1 { font-size: 2rem; margin-bottom: 14px; color: #ebdcb9; text-shadow: 0 2px 4px rgba(0,0,0,.8); text-align: center; }
.modal p { font-size: 1.1rem; margin-bottom: 14px; color: #ccc; line-height: 1.4; }
.modal p.small { font-size: .85rem; opacity: .7; }
.modal .row { display: flex; gap: 12px; justify-content: center; }
.modal .setup .btn, .setup > .btn { width: 100%; margin-top: 6px; }
.field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
.field label { font-size: .75rem; text-transform: uppercase; letter-spacing: 1px; opacity: .75; }
select { padding: 9px; font-size: .95rem; background: #1a0f08; color: #ebdcb9; border: 1px solid #5a351d; border-radius: 6px; cursor: pointer; outline: none; }
.notification { position: absolute; top: 50%; left: calc(50% - var(--home-w) / 2); transform: translate(-50%,-50%); background: rgba(30,18,10,.95); color: #ebdcb9; padding: 14px 28px; border-radius: 8px; border: 2px solid #5a351d; font-size: 1.2rem; font-weight: 700; pointer-events: none; opacity: 0; transition: opacity .3s; z-index: 50; box-shadow: 0 10px 25px rgba(0,0,0,.8); text-align: center; text-transform: uppercase; }
.show-notif { opacity: 1; }

@media (max-width: 700px) {
  .header { flex-wrap: wrap; } .center-info { order: -1; width: 100%; flex-direction: row; gap: 10px; }
  .pname { font-size: .8rem; } .pscore { font-size: 1.3rem; }
  .controls { justify-content: center; } .keys { display: none; }
  .die { width: 40px; height: 40px; padding: 5px; } .dot { width: 8px; height: 8px; }
  .btn { padding: 8px 10px; font-size: .75rem; letter-spacing: .5px; }
}
`;
