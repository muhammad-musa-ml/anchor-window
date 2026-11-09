// A stand-in for the browser. After every change it mounts the blocks in the
// range, measures the ones it has not measured yet (their true heights), and
// reports them to the engine, until nothing new needs measuring. The engine's
// layout then holds what the page would draw.

export function settle(engine, trueHeights, maxPasses = 12) {
  let passes = 0;
  while (passes < maxPasses) {
    const { start, end } = engine.range();
    const entries = [];
    for (let i = start; i < end; i++) {
      if (!engine.layout.isMeasured(i)) entries.push([i, trueHeights[i]]);
    }
    if (entries.length === 0) break;
    engine.measure(entries);
    passes++;
  }
  return passes;
}

/** Where block i is drawn, relative to the top of the viewport. */
export function screenY(engine, i) {
  return engine.layout.offsetOf(i) - engine.scrollTop;
}
