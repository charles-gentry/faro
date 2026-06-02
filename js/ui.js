// DOM rendering and event wiring for the Faro game. Talks to the pure engine.

import { RANKS, LAYOUT_SUIT, suitByKey, rankName } from './cards.js';
import { FaroGame } from './engine.js';

// Traditional Faro layout arrangement: two columns of six with the 7 centred.
const LEFT_COLUMN = ['A', '2', '3', '4', '5', '6'];
const MIDDLE = '7';
const RIGHT_COLUMN = ['8', '9', '10', 'J', 'Q', 'K'];

const CHIP_VALUES = [5, 25, 100, 250];

const game = new FaroGame();
let selectedChip = CHIP_VALUES[1];
let copperMode = false;
let callSelection = null; // { loserRank, winnerRank }
let callMade = false; // true once the call-the-turn bet has been placed/skipped

// --- Element references ---
const el = {
  bankroll: document.getElementById('bankroll'),
  remaining: document.getElementById('remaining'),
  sodaSlot: document.getElementById('soda-slot'),
  loserSlot: document.getElementById('loser-slot'),
  winnerSlot: document.getElementById('winner-slot'),
  layoutGrid: document.getElementById('layout-grid'),
  layoutHint: document.getElementById('layout-hint'),
  chips: document.getElementById('chips'),
  copperBtn: document.getElementById('copper-btn'),
  dealBtn: document.getElementById('deal-btn'),
  clearBtn: document.getElementById('clear-btn'),
  newGameBtn: document.getElementById('new-game-btn'),
  caseGrid: document.getElementById('case-grid'),
  log: document.getElementById('log'),
  callTurn: document.getElementById('call-turn'),
  callTurnOptions: document.getElementById('call-turn-options'),
  callTurnSubmit: document.getElementById('call-turn-submit'),
  callTurnSkip: document.getElementById('call-turn-skip'),
  callTurnAmount: document.getElementById('call-turn-amount'),
};

// --- Card face rendering ---
function cardFace(rank, suitKey) {
  const suit = suitByKey(suitKey);
  const face = document.createElement('div');
  face.className = `card-face ${suit.color}`;
  face.innerHTML = `
    <span class="corner top">${rank}<br>${suit.glyph}</span>
    <span class="pip">${suit.glyph}</span>
    <span class="corner bottom">${rank}<br>${suit.glyph}</span>`;
  return face;
}

function emptySlot(label) {
  const div = document.createElement('div');
  div.className = 'card-empty';
  div.textContent = label || '';
  return div;
}

// --- Layout board ---
function buildLayout() {
  el.layoutGrid.innerHTML = '';

  const make = (rank, column, row, isMiddle = false) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'lay-card';
    card.dataset.rank = rank;
    card.style.gridColumn = String(column);
    if (isMiddle) {
      card.style.gridRow = '1 / 7';
      card.style.alignSelf = 'center';
      card.classList.add('middle');
    } else {
      card.style.gridRow = String(row);
    }
    card.appendChild(cardFace(rank, LAYOUT_SUIT.key));

    const chip = document.createElement('span');
    chip.className = 'bet-chip hidden';
    chip.innerHTML = '<span class="copper-token hidden"></span><span class="bet-amount"></span>';
    card.appendChild(chip);

    card.addEventListener('click', () => onCardTap(rank));
    el.layoutGrid.appendChild(card);
  };

  LEFT_COLUMN.forEach((r, i) => make(r, 1, i + 1));
  make(MIDDLE, 2, 0, true);
  RIGHT_COLUMN.forEach((r, i) => make(r, 3, i + 1));
}

function onCardTap(rank) {
  if (game.phase !== 'betting') return;
  if (game.caseCount[rank] >= 4) {
    log(`The ${rankName(rank)}s are all dealt — that rank is dead.`, 'muted');
    return;
  }
  if (copperMode) {
    // In copper mode a tap toggles the copper flag (placing a chip first if needed).
    if (!game.bets.has(rank)) {
      if (!game.placeBet(rank, selectedChip)) {
        log('Not enough in the bank for that chip.', 'muted');
        return;
      }
    }
    game.toggleCopper(rank);
  } else if (!game.placeBet(rank, selectedChip)) {
    log('Not enough in the bank for that chip.', 'muted');
    return;
  }
  render();
}

function updateLayout() {
  el.layoutGrid.querySelectorAll('.lay-card').forEach((card) => {
    const rank = card.dataset.rank;
    const bet = game.bets.get(rank);
    const chip = card.querySelector('.bet-chip');
    const copper = card.querySelector('.copper-token');
    const amount = card.querySelector('.bet-amount');

    const dead = game.caseCount[rank] >= 4;
    card.classList.toggle('dead', dead && !bet);

    if (bet) {
      chip.classList.remove('hidden');
      amount.textContent = bet.amount;
      chip.classList.toggle('coppered', bet.coppered);
      copper.classList.toggle('hidden', !bet.coppered);
    } else {
      chip.classList.add('hidden');
    }
  });
}

// --- Chips ---
function buildChips() {
  el.chips.innerHTML = '';
  CHIP_VALUES.forEach((value) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip';
    btn.dataset.value = String(value);
    btn.textContent = value;
    btn.addEventListener('click', () => {
      selectedChip = value;
      updateChips();
    });
    el.chips.appendChild(btn);
  });
  updateChips();
}

function updateChips() {
  el.chips.querySelectorAll('.chip').forEach((c) => {
    c.classList.toggle('selected', Number(c.dataset.value) === selectedChip);
  });
}

// --- Case keeper ---
function buildCaseKeeper() {
  el.caseGrid.innerHTML = '';
  RANKS.forEach((rank) => {
    const cell = document.createElement('div');
    cell.className = 'case-cell';
    cell.dataset.rank = rank;
    cell.innerHTML = `<span class="case-rank">${rank}</span>
      <span class="case-dots">${'<i></i>'.repeat(4)}</span>`;
    el.caseGrid.appendChild(cell);
  });
}

function updateCaseKeeper() {
  el.caseGrid.querySelectorAll('.case-cell').forEach((cell) => {
    const dealt = game.caseCount[cell.dataset.rank];
    cell.classList.toggle('dead', dealt >= 4);
    const dots = cell.querySelectorAll('.case-dots i');
    dots.forEach((dot, i) => dot.classList.toggle('filled', i < dealt));
  });
}

// --- Dealing box ---
function renderBoxCards(result) {
  el.sodaSlot.innerHTML = '';
  el.sodaSlot.appendChild(cardFace(game.soda.rank, game.soda.suit));

  el.loserSlot.innerHTML = '';
  el.winnerSlot.innerHTML = '';
  if (result) {
    const loser = cardFace(result.loser.rank, result.loser.suit);
    const winner = cardFace(result.winner.rank, result.winner.suit);
    loser.classList.add('dealt');
    winner.classList.add('dealt');
    el.loserSlot.appendChild(loser);
    el.winnerSlot.appendChild(winner);
  } else {
    el.loserSlot.appendChild(emptySlot());
    el.winnerSlot.appendChild(emptySlot());
  }
}

// --- Logging ---
function log(message, type = '') {
  const li = document.createElement('li');
  li.className = `log-line ${type}`;
  li.textContent = message;
  el.log.prepend(li);
  while (el.log.children.length > 40) el.log.removeChild(el.log.lastChild);
}

function describeOutcomes(result) {
  if (result.outcomes.length === 0) {
    log(`Turn ${result.turnNumber}: ${rankName(result.loser.rank)} loses, ${rankName(result.winner.rank)} wins. No action on your bets.`, 'muted');
    return;
  }
  for (const o of result.outcomes) {
    const tag = o.coppered ? ' (coppered)' : '';
    if (o.result === 'split') {
      log(`Split on ${rankName(o.rank)}s! The bank takes half — you lose ${o.amount / 2}.`, 'split');
    } else if (o.result === 'win') {
      log(`${rankName(o.rank)}${tag} wins — you collect ${o.payout}.`, 'win');
    } else {
      log(`${rankName(o.rank)}${tag} loses — down ${o.amount}.`, 'lose');
    }
  }
}

// --- Call the turn ---
function buildCallTurn() {
  el.callTurnOptions.innerHTML = '';
  callSelection = null;
  const three = game.lastThree();
  if (!three) return;
  const cards = [three.loser, three.winner, three.hock];

  // Every ordered (loser, winner) pairing of the three remaining cards; the third
  // becomes the hock. De-duplicate by the rank labels shown to the player.
  const seen = new Set();
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (i === j) continue;
      const loserRank = cards[i].rank;
      const winnerRank = cards[j].rank;
      const key = `${loserRank}>${winnerRank}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'call-option';
      btn.innerHTML = `<span class="co-lose">${loserRank}</span><span class="co-arrow">→</span><span class="co-win">${winnerRank}</span>`;
      btn.addEventListener('click', () => {
        callSelection = { loserRank, winnerRank };
        el.callTurnOptions.querySelectorAll('.call-option').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        el.callTurnSubmit.disabled = false;
      });
      el.callTurnOptions.appendChild(btn);
    }
  }
  el.callTurnAmount.textContent = selectedChip;
  el.callTurnSubmit.disabled = true;
}

function maybeShowCallTurn() {
  if (game.canCallTurn() && !callMade) {
    if (el.callTurn.classList.contains('hidden')) buildCallTurn();
    el.callTurn.classList.remove('hidden');
  } else {
    el.callTurn.classList.add('hidden');
  }
}

// --- Master render ---
function render(result = null) {
  el.bankroll.textContent = Math.round(game.bankroll * 100) / 100;
  el.remaining.textContent = game.cardsRemaining();
  updateLayout();
  updateCaseKeeper();
  if (result !== 'skip-box') renderBoxCards(result);

  const over = game.phase === 'gameover';
  el.dealBtn.disabled = over || !game.canDeal();
  el.clearBtn.disabled = over || game.bets.size === 0;
  el.dealBtn.textContent = game.canCallTurn() ? 'Deal final turn' : 'Deal turn';

  maybeShowCallTurn();

  if (over) {
    el.layoutHint.textContent = 'The deck is spent. Start a new game.';
  } else {
    el.layoutHint.textContent = copperMode
      ? 'Copper mode: tap a card to bet it will LOSE.'
      : 'Tap a card to place your chip.';
  }
}

// --- Event handlers ---
el.dealBtn.addEventListener('click', () => {
  const result = game.dealTurn();
  if (!result) return;
  describeOutcomes(result);
  if (result.split) {
    /* already logged per outcome */
  }
  if (result.gameover) {
    const hock = game.hock ? `${rankName(game.hock.rank)} of ${suitByKey(game.hock.suit).key}` : 'none';
    log(`The deck is spent. Hock card: ${hock}. Final bank: ${Math.round(game.bankroll)}.`, 'muted');
  }
  render(result);
});

el.clearBtn.addEventListener('click', () => {
  game.clearBets();
  log('Bets withdrawn from the layout.', 'muted');
  render('skip-box');
});

el.newGameBtn.addEventListener('click', () => {
  game.newGame();
  copperMode = false;
  callMade = false;
  el.copperBtn.setAttribute('aria-pressed', 'false');
  el.copperBtn.classList.remove('active');
  el.log.innerHTML = '';
  log('New deal — place your bets on the layout, then deal.', 'muted');
  log(`Soda burned: ${rankName(game.soda.rank)} of ${suitByKey(game.soda.suit).key}.`, 'muted');
  render();
});

el.copperBtn.addEventListener('click', () => {
  copperMode = !copperMode;
  el.copperBtn.setAttribute('aria-pressed', String(copperMode));
  el.copperBtn.classList.toggle('active', copperMode);
  render('skip-box');
});

el.callTurnSubmit.addEventListener('click', () => {
  if (!callSelection) return;
  const result = game.callTurn(callSelection.loserRank, callSelection.winnerRank, selectedChip);
  if (!result) {
    log('Cannot place that call.', 'muted');
    return;
  }
  if (result.correct) {
    log(`Called the turn! ${result.predicted.loserRank} → ${result.predicted.winnerRank} pays ${result.payout}.`, 'win');
  } else {
    log(`Call missed. It came ${result.actual.loserRank} → ${result.actual.winnerRank}. Lost ${result.amount}.`, 'lose');
  }
  callMade = true;
  el.callTurn.classList.add('hidden');
  render('skip-box');
});

el.callTurnSkip.addEventListener('click', () => {
  callMade = true;
  el.callTurn.classList.add('hidden');
});

// --- Boot ---
buildLayout();
buildChips();
buildCaseKeeper();
renderBoxCards(null);
log('Welcome to Faro. Place your bets on the layout, then deal.', 'muted');
log(`Soda burned: ${rankName(game.soda.rank)} of ${suitByKey(game.soda.suit).key}.`, 'muted');
render();
