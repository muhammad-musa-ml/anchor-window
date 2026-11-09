import { captureAnchor, scrollTopFor } from './anchor.js';
import { spacers, visibleRange } from './window.js';

// The scroll state of one page. The caller reports two things: the user
// scrolled (scrollTo) and the browser measured some mounted blocks (measure).
// measure returns the scrollTop the page should be set to.

export class PageWindow {
  constructor({ layout, viewport, overscan = 3, anchoring = true }) {
    this.layout = layout;
    this.viewport = viewport;
    this.overscan = overscan;
    this.anchoring = anchoring;
    this.scrollTop = 0;
    this.anchor = captureAnchor(layout, 0);
  }

  maxScroll() {
    return Math.max(0, this.layout.total() - this.viewport);
  }

  clamp(y) {
    return Math.min(Math.max(0, y), this.maxScroll());
  }

  /** The user scrolled to y. */
  scrollTo(y) {
    this.scrollTop = this.clamp(y);
    this.anchor = captureAnchor(this.layout, this.scrollTop);
    return this.scrollTop;
  }

  /** The browser measured blocks: entries are [index, height] pairs. */
  measure(entries) {
    for (const [index, height] of entries) this.layout.setHeight(index, height);
    if (this.anchoring) this.scrollTop = scrollTopFor(this.layout, this.anchor);
    this.scrollTop = this.clamp(this.scrollTop);
    this.anchor = captureAnchor(this.layout, this.scrollTop);
    return this.scrollTop;
  }

  range() {
    return visibleRange(this.layout, this.scrollTop, this.viewport, this.overscan);
  }

  spacers() {
    return spacers(this.layout, this.range());
  }
}
