# anchor-window

Windowed rendering for a long documentation page, so that deep links and the reading position hold, and a page-wide find can still jump to a match, while only a dozen blocks are mounted.

I wrote it to see what breaks when a page of 10,000 blocks (headings, paragraphs, code, images, lists) is rendered a window at a time. Three things break. Each has tests that fail when its fix is taken out, except the effects in `src/react.js`, which only the Chrome runs below exercise.

1. **The reading position.** A block's height is a guess until it has been mounted and measured. Blocks that scroll into view above the viewport are measured, the guess is replaced, and the text under the reader jumps. `PageWindow` keeps an anchor, a block and how far the viewport sits into it, and after every measurement sets `scrollTop` so that distance is unchanged. The anchor is the block at the top when that block has been measured. Reading upwards by at most a screen it is the block that was at the top before the scroll, if that one was measured. Otherwise it is the estimate at the new top.
2. **Deep links.** `#some-heading` can point into a region nobody has mounted. `scrollToId` jumps to the estimated place and pins the heading there (optionally below a sticky header) while the blocks above it are measured, until the reader scrolls.
3. **Find.** The browser's find only sees mounted text. `buildTextIndex` and `find` cover the whole page and `scrollToBlock` jumps to the block of a match.

`Layout` keeps the heights in a Fenwick tree, so where a block starts, which block sits at an offset and a new measurement each cost O(log n).

## Files

- `src/layout.js`, `window.js`, `anchor.js`, `engine.js`, `find.js`, `measure.js`: the logic, no dependencies. `measure.js` is the step between the `ResizeObserver` and the window.
- `src/react.js`: `WindowedPage`, a scroll container that mounts the window, measures the mounted blocks (a layout effect for new ones, a `ResizeObserver` for changes) and sets `scrollTop`.
- `sim/`: a made-up page and a stand-in for the browser. `bench/`: the measurements. `demo/`: a page you can open, and the scripts that drive it in headless Chrome.

## Run it

```
npm install
npm test                 # 60 tests
npm run bench            # simulation: writes results/results.md
npm run build:demo
npm run measure          # headless Chrome, three modes: writes results/browser/
node bench/summarize-browser.mjs
npm run check:demo       # a #heading link and page-wide find, in headless Chrome: writes results/check.md
npm run demo             # then open http://127.0.0.1:8765/demo/index.html#h-4003
```

`measure` and `check:demo` need Chrome; set `CHROME_PATH` if it is not at the Windows default.

## Results

Simulation (`npm run bench`): 10,000 blocks, 200 seeded sessions, a different made-up page for each seed. The text the reader was looking at should move by exactly the scroll step; a jump is the distance from that. Cells are median (min to max).

| Reading upwards, 300 scroll steps (scrollTop set directly) | no correction | with anchoring |
| --- | --- | --- |
| largest single jump, px | 489.5 (316.0 to 1065.0) | 0.0 (0.0 to 0.0) |
| steps with a jump over 1 px, of 300 | 157 (139 to 174) | 0 (0 to 0) |

| Deep link to a random heading, 72 px below the top | one jump, anchoring off | pinned |
| --- | --- | --- |
| distance from the intended place, px | 108.5 (2.0 to 728.0) | 0.0 (0.0 to 0.0) |
| sessions with the heading off screen, of 200 | 76 | 0 |

Find, simulation: the share of the page-wide matches that fall inside the mounted blocks, which is all the browser's own find can see, is a median 0.11% (0.00% to 0.82%). That pools 3 queries at 200 random scroll positions on one page, with about 12 blocks mounted on average; the page-wide index finds 12,464 matches for "token".

Layout cost, 2,000 measure-and-query operations on 100,000 blocks, 7 runs, ms: a loop over the blocks above takes 2215.4 (1500.0 to 2814.2), the Fenwick tree 12.33 (1.56 to 18.90). The milliseconds change a lot between runs of this benchmark: the loop's median was 424, 3,604, 559 and 2,215 ms in four runs, so I read the ratio of the two medians, which was 207, 207, 311 and 180.

Headless Chrome 156.0.8078.80 (`npm run measure`): one made-up page (seed 1) rendered by `WindowedPage`, 10 sessions of 100 scroll steps (scrollTop set directly, not wheel events), a 700 px container, devicePixelRatio 1, 10 blocks mounted after the last session. In the first two rows the deep link is one assignment to `scrollTop` at the estimated offset.

| mode | largest jump, px | steps with a jump over 1 px, of 100 | deep link: distance from the intended place, px |
| --- | --- | --- | --- |
| no correction, Chrome scroll anchoring off | 394 (369 to 583) | 52 (48 to 54) | 77 (24 to 435) |
| no correction, Chrome's own scroll anchoring on | 153 (0 to 519) | 2 (0 to 3) | 77 (24 to 435) |
| this window | 0 (0 to 0) | 0 (0 to 0) | 0 (0 to 0) |

Chrome's own anchoring removes most of the jumps in this layout (a median of 2 steps of 100 against 52), but the ones that remain are large, up to 519 px.

Find, Chrome (`npm run check:demo`): a `#h-4003` link lands with the heading 0 px from the top, and stepping through the matches for "refresh token" reaches block 2109 at 0 px from the top with 12 blocks mounted. The text of the document held 3 of the 489 matches (`results/check.md`).

## What the Chrome run caught

The simulation passed before the browser did. Three bugs showed up only in Chrome and now have tests:

- A measurement that arrived before the scroll event used the old `scrollTop` and put the reader back where they were. `measureAt` tells the window the DOM's `scrollTop` before it measures.
- A block that was just unmounted reports a height of 0 to the `ResizeObserver`, which shrank the layout. `entriesFromRecords` skips nodes that are no longer in the document.
- After a long run of steps the anchor could be replaced by a block that had never been measured. A scroll upwards now anchors on the block that was at the top before only if that block was measured.

My first jump metric also tracked a block that had never been painted, so its numbers were wrong until I changed it to follow the block the reader was looking at.

## What this does not show

- The page is made up. Block heights are drawn uniformly from a range for each kind of block and the estimate is the middle of the range, so real pages will have different errors.
- One browser: Chrome 156, headless, on Windows. I did not run Firefox or Safari.
- Every scroll is a `scrollTop` set by a script. Wheel events, scrollbar drags and touch are not exercised, and only upward steps and jumps are measured in Chrome.
- Blocks have fixed CSS heights. Images that load late, fonts that change wrapping and a resize of the page width are not exercised, and a width change does not re-measure every block.
- Find is a plain-text index: no highlighting, and it is not wired to Ctrl+F. `stepMatch` moves from one block with a match to the next, not from one occurrence to the next. Unmounted blocks are also not in the DOM for screen readers.
- `WindowedPage` does not measure a container whose `clientHeight` is 0, such as one hidden with `display: none`. I tested that check with a stand-in object, not in Chrome.
- `src/react.js` has a server-render test and the Chrome runs, but no test of its effects.
- The Chrome numbers come from one machine and one run of 10 sessions.
