// Heights of the blocks of one page. A block has its estimated height until
// the browser has measured it. Prefix sums live in a Fenwick tree, so asking
// where block i starts, or which block sits at a given offset, costs O(log n)
// and a new measurement costs O(log n) as well.

export class Layout {
  /** @param {ArrayLike<number>} estimates height guess for each block, in px */
  constructor(estimates) {
    this.n = estimates.length;
    this.h = Float64Array.from(estimates);
    this.measured = new Uint8Array(this.n);
    this.tree = new Float64Array(this.n + 1);
    for (let i = 1; i <= this.n; i++) {
      this.tree[i] += this.h[i - 1];
      const parent = i + (i & -i);
      if (parent <= this.n) this.tree[parent] += this.tree[i];
    }
    this.top = 1;
    while (this.top * 2 <= this.n) this.top *= 2;
  }

  height(i) {
    return this.h[i];
  }

  isMeasured(i) {
    return this.measured[i] === 1;
  }

  /** Record a measured height. Returns how much the height changed. */
  setHeight(i, value) {
    const delta = value - this.h[i];
    this.h[i] = value;
    this.measured[i] = 1;
    if (delta !== 0) {
      for (let k = i + 1; k <= this.n; k += k & -k) this.tree[k] += delta;
    }
    return delta;
  }

  /** Where block i starts: the sum of the heights of blocks 0 .. i-1. */
  offsetOf(i) {
    let sum = 0;
    for (let k = i; k > 0; k -= k & -k) sum += this.tree[k];
    return sum;
  }

  total() {
    return this.offsetOf(this.n);
  }

  /** The block that contains offset y, clamped to the first and last block. */
  indexAt(y) {
    if (this.n === 0 || y <= 0) return 0;
    let pos = 0;
    let rest = y;
    for (let step = this.top; step > 0; step >>= 1) {
      const next = pos + step;
      if (next <= this.n && this.tree[next] <= rest) {
        pos = next;
        rest -= this.tree[next];
      }
    }
    return Math.min(pos, this.n - 1);
  }
}
