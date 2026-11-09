// Which blocks to mount for a scroll position, and how much blank space stands
// in for the blocks that are not mounted.

/**
 * Blocks to mount: every block that touches the viewport, plus `overscan`
 * blocks on each side. `end` is exclusive.
 */
export function visibleRange(layout, scrollTop, viewport, overscan = 3) {
  const first = layout.indexAt(scrollTop);
  const last = layout.indexAt(scrollTop + viewport);
  return {
    start: Math.max(0, first - overscan),
    end: Math.min(layout.n, last + 1 + overscan),
  };
}

/** Heights of the two empty spacers that keep the scroll height right. */
export function spacers(layout, range) {
  return {
    before: layout.offsetOf(range.start),
    after: layout.total() - layout.offsetOf(range.end),
  };
}
