import { captureAnchor, scrollTopFor } from './anchor.js';
import { spacers, visibleRange } from './window.js';

// The scroll state of one page. The caller reports two things: the user
// scrolled (scrollTo) and the browser measured some mounted blocks (measure).
// Both return the scrollTop the page should be set to.
//
// ids[i] is the anchor id of block i (a heading id) or a falsy value.
//
// The anchor is a block that has been measured and is still mounted, and the
// distance from its top to the top of the viewport. A user scroll only changes
// that distance, so the blocks the user saw keep moving by exactly the scroll
// delta whatever the blocks that scroll into view turn out to measure.

export class PageWindow {
  constructor({ layout, viewport, overscan = 3, anchoring = true, ids = [] }) {
    this.layout = layout;
    this.viewport = viewport;
    this.overscan = overscan;
    this.anchoring = anchoring;
    this.indexById = new Map();
    ids.forEach((id, index) => {
      if (id && !this.indexById.has(id)) this.indexById.set(id, index);
    });
    this.scrollTop = 0;
    this.anchor = captureAnchor(layout, 0);
    this.pinned = false;
  }

  maxScroll() {
    return Math.max(0, this.layout.total() - this.viewport);
  }

  clamp(y) {
    return Math.min(Math.max(0, y), this.maxScroll());
  }

  /**
   * The user scrolled to y. A value within a pixel of the current scrollTop is
   * the echo of a scroll we set ourselves and changes nothing.
   */
  scrollTo(y) {
    const next = this.clamp(y);
    if (Math.abs(next - this.scrollTop) < 1) return this.scrollTop;
    // The block at the top of the last settled state is mounted, so it has
    // been measured. Anchoring on it keeps everything the user was looking at
    // rigid; anchoring on the block at the new top could pick one that has
    // never been measured. A scroll of more than a screen shares no content
    // with the old one, so it takes the block at the new top.
    const seen = this.layout.indexAt(this.scrollTop);
    const near = Math.abs(next - this.scrollTop) <= this.viewport && this.layout.isMeasured(seen);
    this.anchor = near
      ? { index: seen, offset: next - this.layout.offsetOf(seen) }
      : captureAnchor(this.layout, next);
    this.scrollTop = next;
    this.pinned = false;
    return this.scrollTop;
  }

  /**
   * Jump to the block with this id, `margin` px below the top of the viewport
   * (room for a sticky header). The target stays pinned there while the blocks
   * above it are measured, until the user scrolls. Returns null for an
   * unknown id.
   */
  scrollToId(id, margin = 0) {
    const index = this.indexById.get(id);
    if (index === undefined) return null;
    return this.scrollToBlock(index, margin);
  }

  /** Same as scrollToId, for a block index (a find result, say). */
  scrollToBlock(index, margin = 0) {
    if (!(index >= 0 && index < this.layout.n)) return null;
    this.scrollTop = this.clamp(this.layout.offsetOf(index) - margin);
    this.anchor = { index, offset: -margin };
    this.pinned = true;
    return { index, scrollTop: this.scrollTop };
  }

  /** The browser measured blocks: entries are [index, height] pairs. */
  measure(entries) {
    for (const [index, height] of entries) this.layout.setHeight(index, height);
    if (!this.anchoring) {
      this.scrollTop = this.clamp(this.scrollTop);
      this.anchor = captureAnchor(this.layout, this.scrollTop);
      return this.scrollTop;
    }
    const wanted = scrollTopFor(this.layout, this.anchor);
    this.scrollTop = this.clamp(wanted);
    if (this.scrollTop !== wanted) {
      this.anchor = captureAnchor(this.layout, this.scrollTop);
      this.pinned = false;
    }
    return this.scrollTop;
  }

  range() {
    return visibleRange(this.layout, this.scrollTop, this.viewport, this.overscan);
  }

  spacers() {
    return spacers(this.layout, this.range());
  }
}
