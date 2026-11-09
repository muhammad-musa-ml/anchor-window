import { captureAnchor, scrollTopFor } from './anchor.js';
import { spacers, visibleRange } from './window.js';

// The scroll state of one page. The caller reports two things: the user
// scrolled (scrollTo) and the browser measured some mounted blocks (measure).
// Both return the scrollTop the page should be set to.
//
// ids[i] is the anchor id of block i (a heading id) or a falsy value.
//
// The anchor is a block and the distance from its top to the top of the
// viewport. When the user scrolls it is the block at the new top if that has
// been measured; reading up by at most a screen, the block that was at the top
// before if that has been measured; otherwise the estimate at the new top.
// After a measurement the window sets scrollTop so that distance is unchanged,
// which keeps the text where it was whatever the blocks above it turn out to
// measure, except where scrollTop is clamped at the start or the end of the
// page.

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

  /** The block at the top of the viewport as an anchor, if it has been measured. */
  topAnchor() {
    const index = this.layout.indexAt(this.scrollTop);
    if (!this.layout.isMeasured(index)) return null;
    return { index, offset: this.scrollTop - this.layout.offsetOf(index) };
  }

  /**
   * The user scrolled to y. A change of less than a pixel is taken to be the
   * echo of a scroll we set ourselves and changes nothing; a real scroll that
   * small is dropped too.
   */
  scrollTo(y) {
    const next = this.clamp(y);
    if (Math.abs(next - this.scrollTop) < 1) return this.scrollTop;
    const top = this.layout.indexAt(next);
    if (this.layout.isMeasured(top)) {
      this.anchor = { index: top, offset: next - this.layout.offsetOf(top) };
    } else {
      // The block that scrolls to the top has never been measured, so its
      // place is only an estimate. Reading upwards by up to a screen, the
      // block that was at the top before has been measured and is still in
      // view: anchoring on it keeps what the reader was looking at moving by
      // exactly the scroll step. In every other case the estimate at the new
      // top is all there is to hold on to.
      const seen = this.layout.indexAt(this.scrollTop);
      const up = this.scrollTop - next;
      const readingUp = up > 0 && up <= this.viewport && this.layout.isMeasured(seen);
      this.anchor = readingUp
        ? { index: seen, offset: next - this.layout.offsetOf(seen) }
        : captureAnchor(this.layout, next);
    }
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
    if (!Number.isInteger(index) || index < 0 || index >= this.layout.n) return null;
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
    } else if (!this.pinned) {
      // Move the anchor to the block at the top, which is nearer to the text
      // being read, so a later height change between the two is compensated.
      this.anchor = this.topAnchor() ?? this.anchor;
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
