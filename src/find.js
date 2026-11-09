// The browser's find only sees text that is mounted. With a window of about
// twenty blocks out of thousands, most matches are invisible to it. This
// index holds the plain text of every block, so a search covers the whole
// page and the result can be turned into a jump.

const squash = (text) => String(text ?? '').toLowerCase().replace(/\s+/g, ' ');

export function buildTextIndex(texts) {
  return texts.map(squash);
}

/**
 * Matches in block order: [{ block, count }]. The comparison ignores case and
 * the amount of white space, and counts occurrences that do not overlap.
 */
export function find(index, query) {
  const needle = squash(query).trim();
  if (needle === '') return [];
  const matches = [];
  for (let block = 0; block < index.length; block++) {
    let count = 0;
    let from = index[block].indexOf(needle);
    while (from !== -1) {
      count++;
      from = index[block].indexOf(needle, from + needle.length);
    }
    if (count > 0) matches.push({ block, count });
  }
  return matches;
}

/** Total number of occurrences in a result of find. */
export function totalCount(matches) {
  return matches.reduce((sum, m) => sum + m.count, 0);
}

/**
 * The block of the next (direction 1) or previous (direction -1) match after
 * `current`, wrapping around at the ends. Returns null without matches.
 */
export function stepMatch(matches, current, direction = 1) {
  if (matches.length === 0) return null;
  if (direction >= 0) {
    const after = matches.find((m) => m.block > current);
    return (after ?? matches[0]).block;
  }
  for (let k = matches.length - 1; k >= 0; k--) {
    if (matches[k].block < current) return matches[k].block;
  }
  return matches[matches.length - 1].block;
}
