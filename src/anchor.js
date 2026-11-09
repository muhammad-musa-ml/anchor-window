// An anchor is a block and how far into it the viewport starts; captureAnchor
// takes the block at the top of the viewport (engine.js also anchors on the
// block that was at the top before a scroll, or on the target of a jump). When
// blocks above it change height, putting the viewport back at the same place
// in the anchor block keeps the text from jumping.

export function captureAnchor(layout, scrollTop) {
  const index = layout.indexAt(scrollTop);
  return { index, offset: scrollTop - layout.offsetOf(index) };
}

export function scrollTopFor(layout, anchor) {
  return layout.offsetOf(anchor.index) + anchor.offset;
}
