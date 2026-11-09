Page of 10000 blocks, 200 seeded sessions. Each cell is median (min to max).

| Reading upwards, 300 wheel steps | no correction | with anchoring |
| --- | --- | --- |
| largest single jump, px | 489.5 (316.0 to 1065.0) | 0.0 (0.0 to 0.0) |
| total jump over the session, px | 13599 (11565 to 15987) | 0.0 (0.0 to 0.0) |
| steps with a jump over 1 px, of 300 | 157 (139 to 174) | 0 (0 to 0) |

| Deep link to a random heading, 72 px below the top | no pin | pinned |
| --- | --- | --- |
| distance from the intended place, px | 108.5 (2.0 to 728.0) | 0.0 (0.0 to 0.0) |
| sessions more than 1 px off, of 200 | 200 | 0 |
| sessions with the heading off screen, of 200 | 76 | 0 |

Find: the browser's own find, at a random scroll position with about 12.1 blocks mounted, sees a median 0.11% (0.00% to 0.82%) of the matches the page-wide index finds. Page-wide counts: "token" 12464, "webhook" 12453, "refresh token" 489.

| Layout cost, 2000 operations on 100000 blocks, 7 runs, ms | prefix loop | Fenwick tree |
| --- | --- | --- |
| median (min to max) | 3603.6 (3086.7 to 4661.3) | 17.42 (1.98 to 28.70) |
