// The anchor is the block at the top of the viewport and how far into it the
// viewport starts. When blocks above it change height, putting the viewport
// back at the same place in the anchor block keeps the text from jumping.

export function captureAnchor(layout, scrollTop) {
  const index = layout.indexAt(scrollTop);
  return { index, offset: scrollTop - layout.offsetOf(index) };
}

export function scrollTopFor(layout, anchor) {
  return layout.offsetOf(anchor.index) + anchor.offset;
}
