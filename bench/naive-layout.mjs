// The layout without prefix sums: every offset is a loop over the blocks
// above it. It exists to be compared with Layout, nothing uses it otherwise.
export class NaiveLayout {
  constructor(estimates) {
    this.n = estimates.length;
    this.h = Float64Array.from(estimates);
  }

  setHeight(i, value) {
    this.h[i] = value;
  }

  offsetOf(i) {
    let sum = 0;
    for (let k = 0; k < i; k++) sum += this.h[k];
    return sum;
  }

  indexAt(y) {
    let start = 0;
    for (let k = 0; k < this.n; k++) {
      if (y < start + this.h[k]) return k;
      start += this.h[k];
    }
    return this.n - 1;
  }
}
