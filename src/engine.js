import { captureAnchor, scrollTopFor } from './anchor.js';
import { spacers, visibleRange } from './window.js';

// The scroll state of one page. The caller reports two things: the user
// scrolled (scrollTo) and the browser measured some mounted blocks (measure).
// Both return the scrollTop the page should be set to.
//
// ids[i] is the anchor id of block i (a heading id) or a falsy value.

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
    this.scrollTop = next;
    this.anchor = captureAnchor(this.layout, this.scrollTop);
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
    this.scrollTop = this.clamp(this.layout.offsetOf(index) - margin);
    this.anchor = { index, offset: -margin };
    this.pinned = true;
    return { index, scrollTop: this.scrollTop };
  }

  /** The browser measured blocks: entries are [index, height] pairs. */
  measure(entries) {
    for (const [index, height] of entries) this.layout.setHeight(index, height);
    if (this.anchoring) this.scrollTop = scrollTopFor(this.layout, this.anchor);
    this.scrollTop = this.clamp(this.scrollTop);
    if (!this.pinned) this.anchor = captureAnchor(this.layout, this.scrollTop);
    return this.scrollTop;
  }

  range() {
    return visibleRange(this.layout, this.scrollTop, this.viewport, this.overscan);
  }

  spacers() {
    return spacers(this.layout, this.range());
  }
}
