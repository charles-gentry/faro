// Card definitions and deck utilities for the Faro game.

export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

// Suits with their display glyphs and colour class.
export const SUITS = [
  { key: 'spades', glyph: '♠', color: 'black' },
  { key: 'hearts', glyph: '♥', color: 'red' },
  { key: 'diamonds', glyph: '♦', color: 'red' },
  { key: 'clubs', glyph: '♣', color: 'black' },
];

// The reference suit used for the betting layout board.
export const LAYOUT_SUIT = SUITS[0]; // spades

export function suitByKey(key) {
  return SUITS.find((s) => s.key === key);
}

// Human-friendly rank name, used in the message log.
const RANK_NAMES = {
  A: 'Ace', J: 'Jack', Q: 'Queen', K: 'King',
};
export function rankName(rank) {
  return RANK_NAMES[rank] || rank;
}

// Build an ordered 52-card deck. Each card is { rank, suit } where suit is a key.
export function buildDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit: suit.key });
    }
  }
  return deck;
}

// Fisher–Yates shuffle. Returns the same array, shuffled in place.
export function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
