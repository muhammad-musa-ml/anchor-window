# anchor-window

Windowed rendering for a long documentation page, so that deep links, the reading position and find keep working while only a dozen blocks are mounted.

I wrote it to see what breaks when a page of 10,000 blocks (headings, paragraphs, code, images, lists) is rendered a window at a time, and to fix each break with a test that fails without the fix. Three things break:

1. **The reading position.** A block's height is a guess until it has been mounted and measured. Blocks that scroll into view above the viewport are measured, the guess is replaced, and the text under the reader jumps. `PageWindow` anchors on the block that was at the top before the scroll and sets `scrollTop` after every measurement so that block moves by exactly the scroll step.
2. **Deep links.** `#some-heading` can point into a region nobody has mounted. `scrollToId` jumps to the estimated place and pins the heading there (optionally below a sticky header) while the blocks above it are measured, until the reader scrolls.
3. **Find.** The browser's find only sees mounted text. `buildTextIndex` and `find` cover the whole page and `scrollToBlock` jumps to a match.

`Layout` keeps the heights in a Fenwick tree, so where a block starts, which block sits at an offset and a new measurement each cost O(log n).

## Files

- `src/layout.js`, `window.js`, `anchor.js`, `engine.js`, `find.js`: the logic, no dependencies.
- `src/react.js`: `WindowedPage`, a scroll container that mounts the window, measures it with a `ResizeObserver` and sets `scrollTop`.
- `sim/`: a made-up page and a stand-in for the browser. `bench/`: the measurements. `demo/`: a page you can open, and the scripts that drive it in headless Chrome.

## Run it

```
npm install
npm test                 # 47 tests
npm run bench            # simulation: writes results/results.md
npm run build:demo
npm run measure          # headless Chrome, three modes: writes results/browser/
node bench/summarize-browser.mjs
npm run check:demo       # a #heading link and page-wide find, in headless Chrome
npm run demo             # then open http://127.0.0.1:8765/demo/index.html#h-4003
```

`measure` and `check:demo` need Chrome; set `CHROME_PATH` if it is not at the Windows default.

## Results

Simulation (`npm run bench`): 10,000 blocks, 200 seeded sessions, about 12 blocks mounted at a time. The text the reader was looking at should move by exactly the wheel step; a jump is the distance from that. Cells are median (min to max).

| Reading upwards, 300 wheel steps | no correction | with anchoring |
| --- | --- | --- |
| largest single jump, px | 489.5 (316.0 to 1065.0) | 0.0 (0.0 to 0.0) |
| steps with a jump over 1 px, of 300 | 157 (139 to 174) | 0 (0 to 0) |

| Deep link to a random heading, 72 px below the top | no pin | pinned |
| --- | --- | --- |
| distance from the intended place, px | 108.5 (2.0 to 728.0) | 0.0 (0.0 to 0.0) |
| sessions with the heading off screen, of 200 | 76 | 0 |

The browser's own find, with about 12 blocks mounted, sees a median 0.11% (0.00% to 0.82%) of the matches the page-wide index finds (12,464 for "token").

Layout cost, 2,000 measure-and-query operations on 100,000 blocks, 7 runs, ms: a loop over the blocks above takes 559.0 (452.2 to 645.0), the Fenwick tree 1.80 (1.57 to 5.30). Other work was running on the machine, and an earlier run of the same benchmark took several times longer for both, so I trust the ratio and not the milliseconds.

Headless Chrome 156 (`npm run measure`): the same page rendered by `WindowedPage`, 10 sessions of 100 wheel steps, a 700 px container, 10 to 14 blocks mounted.

| mode | largest jump, px | steps with a jump over 1 px, of 100 | deep link: distance from the intended place, px |
| --- | --- | --- | --- |
| no correction, Chrome scroll anchoring off | 394 (369 to 583) | 52 (48 to 54) | 77 (24 to 435) |
| no correction, Chrome's own scroll anchoring on | 153 (0 to 519) | 2 (0 to 3) | 77 (24 to 435) |
| this window | 0 (0 to 0) | 0 (0 to 0) | 0 (0 to 0) |

Chrome's own anchoring removes most of the jumps in this layout (2 steps of 100 against 52), but the ones that remain are large, up to 519 px.

## What the Chrome run caught

The simulation passed before the browser did. Three bugs showed up only in Chrome:

- A measurement that arrived before the scroll event used the old `scrollTop` and put the reader back where they were. The component now tells the window the DOM's `scrollTop` before it measures.
- A block that was just unmounted reports a height of 0 to the `ResizeObserver`, which shrank the layout. Those reports are skipped.
- After a long run of steps the anchor could be replaced by a block that had never been measured. A scroll within one screen now anchors on the block that was at the top before the scroll.

My first jump metric also tracked a block that had never been painted, so its numbers were wrong until I changed it to follow the block the reader was looking at.

## What this does not show

- The page is made up. Block heights are uniform within each kind and the estimate is the middle of the range, so real pages will have different errors.
- One browser: Chrome 156, headless, on Windows. I did not run Firefox or Safari.
- Blocks have fixed CSS heights. Images that load late, fonts that change wrapping and a resize of the page width are not exercised, and a width change does not re-measure every block.
- Only upward wheel steps and jumps are measured, not scrollbar drags or touch.
- Find is a plain-text index: no highlighting, and it is not wired to Ctrl+F. Unmounted blocks are also not in the DOM for screen readers.
- The Chrome numbers come from one machine and one run of 10 sessions.
