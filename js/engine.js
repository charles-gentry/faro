// Pure Faro game engine. No DOM access — all state and rules live here so the
// logic can be reasoned about and tested in isolation.

import { RANKS, buildDeck, shuffle } from './cards.js';

export const STARTING_BANKROLL = 1000;
const CALL_TURN_PAYOUT = 4; // calling the turn pays 4 to 1

export class FaroGame {
  constructor() {
    this.newGame();
  }

  // Build & shuffle a fresh deck, burn the soda, reset all state.
  newGame(bankroll = STARTING_BANKROLL) {
    this.deck = shuffle(buildDeck());
    this.bankroll = bankroll;
    this.bets = new Map(); // rank -> { amount, coppered }
    this.caseCount = {};
    for (const r of RANKS) this.caseCount[r] = 0;
    this.history = [];
    this.phase = 'betting'; // 'betting' | 'gameover'
    this.turnNumber = 0;

    // The soda is the first card off the top — exposed and counted, but no action.
    this.soda = this.deck[0];
    this.position = 1;
    this.caseCount[this.soda.rank] += 1;
    this.hock = null;
    return this.soda;
  }

  // --- Bet management (allowed only between turns) ---

  placeBet(rank, amount) {
    if (this.phase !== 'betting') return false;
    if (amount <= 0 || amount > this.bankroll) return false;
    const existing = this.bets.get(rank);
    if (existing) {
      existing.amount += amount;
    } else {
      this.bets.set(rank, { amount, coppered: false });
    }
    this.bankroll -= amount;
    return true;
  }

  setCopper(rank, coppered) {
    const bet = this.bets.get(rank);
    if (bet) bet.coppered = coppered;
  }

  toggleCopper(rank) {
    const bet = this.bets.get(rank);
    if (bet) bet.coppered = !bet.coppered;
  }

  // Withdraw a single bet, returning the stake to the bankroll.
  removeBet(rank) {
    const bet = this.bets.get(rank);
    if (!bet) return;
    this.bankroll += bet.amount;
    this.bets.delete(rank);
  }

  clearBets() {
    for (const rank of [...this.bets.keys()]) this.removeBet(rank);
  }

  totalAtStake() {
    let total = 0;
    for (const bet of this.bets.values()) total += bet.amount;
    return total;
  }

  // --- Dealing ---

  cardsRemaining() {
    return this.deck.length - this.position;
  }

  canDeal() {
    return this.phase === 'betting' && this.cardsRemaining() >= 2;
  }

  // True when exactly three cards remain (loser, winner, hock) — the player may
  // call the turn for a 4:1 payout.
  canCallTurn() {
    return this.phase === 'betting' && this.cardsRemaining() === 3;
  }

  // The three remaining ranks, for presenting call-the-turn options.
  lastThree() {
    if (this.cardsRemaining() !== 3) return null;
    return {
      loser: this.deck[this.position],
      winner: this.deck[this.position + 1],
      hock: this.deck[this.position + 2],
    };
  }

  // Deal one turn: loser card first, then winner card. Resolves all standing bets
  // and returns a structured result describing the outcome.
  dealTurn() {
    if (!this.canDeal()) return null;

    const loser = this.deck[this.position];
    const winner = this.deck[this.position + 1];
    this.position += 2;
    this.caseCount[loser.rank] += 1;
    this.caseCount[winner.rank] += 1;
    this.turnNumber += 1;

    const split = loser.rank === winner.rank;
    const outcomes = [];

    for (const [rank, bet] of [...this.bets.entries()]) {
      if (split && rank === loser.rank) {
        // Split: the house takes half the bet on that rank; half is returned.
        const returned = bet.amount / 2;
        this.bankroll += returned;
        outcomes.push({
          rank, result: 'split', coppered: bet.coppered,
          amount: bet.amount, payout: returned - bet.amount, // net (negative)
        });
        this.bets.delete(rank);
      } else if (rank === loser.rank) {
        if (bet.coppered) {
          // Coppered bet on the losing card wins even money.
          this.bankroll += bet.amount * 2;
          outcomes.push({ rank, result: 'win', coppered: true, amount: bet.amount, payout: bet.amount });
        } else {
          // Plain bet on the losing card loses the stake.
          outcomes.push({ rank, result: 'lose', coppered: false, amount: bet.amount, payout: -bet.amount });
        }
        this.bets.delete(rank);
      } else if (rank === winner.rank) {
        if (bet.coppered) {
          // Coppered bet on the winning card loses.
          outcomes.push({ rank, result: 'lose', coppered: true, amount: bet.amount, payout: -bet.amount });
        } else {
          // Plain bet on the winning card wins even money.
          this.bankroll += bet.amount * 2;
          outcomes.push({ rank, result: 'win', coppered: false, amount: bet.amount, payout: bet.amount });
        }
        this.bets.delete(rank);
      }
      // Otherwise the bet is undecided and stays on the table.
    }

    const result = { loser, winner, split, outcomes, turnNumber: this.turnNumber, gameover: false };
    this.history.push(result);

    // One card (the hock) left over means the deck is spent.
    if (this.cardsRemaining() <= 1) {
      this.hock = this.cardsRemaining() === 1 ? this.deck[this.position] : null;
      this.phase = 'gameover';
      result.gameover = true;
    }

    return result;
  }

  // Resolve a call-the-turn bet predicting the order of the final loser & winner.
  // `amount` is staked separately from layout bets. Pays 4:1 on an exact match.
  callTurn(loserRank, winnerRank, amount) {
    if (!this.canCallTurn()) return null;
    if (amount <= 0 || amount > this.bankroll) return null;

    this.bankroll -= amount;
    const { loser, winner } = this.lastThree();
    const correct = loser.rank === loserRank && winner.rank === winnerRank;

    if (correct) {
      this.bankroll += amount + amount * CALL_TURN_PAYOUT;
    }

    return {
      correct,
      predicted: { loserRank, winnerRank },
      actual: { loserRank: loser.rank, winnerRank: winner.rank },
      amount,
      payout: correct ? amount * CALL_TURN_PAYOUT : -amount,
    };
  }
}
