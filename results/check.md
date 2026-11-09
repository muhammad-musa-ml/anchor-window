Headless Chrome, demo page of 10000 blocks, engine mode (npm run check:demo).

- Link to #h-4003: the heading is 0 px from the top of the page.
- Page-wide find for "refresh token": 489 matches in 478 blocks, at block 2109; pressing next 100 times (one block per press) lands on block 2109, 0 px from the top, with 12 blocks mounted.
- "refresh token" in document.body.innerText, which is what the browser's find sees: 3 of the 489 matches in the page.
