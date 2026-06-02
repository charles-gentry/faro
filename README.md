# Faro

A mobile-first web game of **Faro**, the 19th-century gambling card game of the
American West. Bet on card ranks against the bank, count cards with the case
keeper, and call the turn for a 4:1 payout. No build step, no dependencies —
just open it in a browser.

## How to play

1. **Open the game** — open `index.html` directly in a browser, or serve the
   folder (see *Running* below) and visit it on your phone.
2. **Pick a chip** value, then **tap cards** on the layout to place bets.
   The layout shows one suit of spades in the traditional Faro arrangement:
   two columns of six with the **7** in the middle.
3. **Copper mode** — tap *Copper mode*, then tap a card to bet that the rank will
   **lose** (a coppered bet) instead of win.
4. **Deal turn** — the dealer reveals two cards:
   - the **loser** (bank) card first — plain bets on that rank lose,
     coppered bets win;
   - the **winner** (player) card second — plain bets win even money,
     coppered bets lose.
5. **Splits** — if both cards are the same rank, it's a *split* and the bank
   takes **half** of any bet on that rank (the house edge).
6. **Case keeper** — the tracker fills a dot for each card dealt, so you can see
   what's left. A rank with all four cards out is *dead*.
7. **Call the turn** — when only three cards remain, predict the exact order of
   the final loser and winner for a **4:1** payout.
8. **New game** reshuffles the deck and burns a fresh **soda** card.

You start with a bank of **1000**.

## Running

It's plain static files, so any static server works:

```sh
python3 -m http.server
# then open http://localhost:8000
```

Or just open `index.html` from disk.

## Project structure

```
index.html        page structure
css/styles.css    green-felt, mobile-first styling
js/cards.js       deck construction & shuffle
js/engine.js      FaroGame — pure rules engine (no DOM)
js/ui.js          rendering + event handling
```

The rules live entirely in `js/engine.js` and are kept free of any DOM access,
so the game logic can be reasoned about and tested on its own.
