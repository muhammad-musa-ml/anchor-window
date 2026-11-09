// The two steps of turning ResizeObserver records into a corrected scrollTop,
// kept apart from React so that they can be tested without a browser.

/**
 * [index, height] pairs for the records that changed a block's height by half
 * a pixel or more. A block that was just unmounted reports a height of 0, so
 * records for nodes that are no longer in the document are skipped.
 */
export function entriesFromRecords(records, layout) {
  const entries = [];
  for (const record of records) {
    const node = record.target;
    if (!node.isConnected) continue;
    const index = Number(node.dataset.index);
    const size = node.getBoundingClientRect().height;
    if (Math.abs(size - layout.height(index)) >= 0.5) entries.push([index, size]);
  }
  return entries;
}

/**
 * A container that is not laid out (display: none, say) reports every block as
 * 0 px high, and storing those heights would shrink the whole page.
 */
export function canMeasure(scroller) {
  return scroller.clientHeight > 0;
}

/**
 * Report measurements to the window. The browser can move scrollTop before its
 * scroll event reaches us; correcting from the old position would undo the
 * user's scroll, so the window is told the DOM's scrollTop first.
 */
export function measureAt(page, domScrollTop, entries) {
  page.scrollTo(domScrollTop);
  return page.measure(entries);
}
