// An anchor is a block and the distance from its top to the top of the
// viewport (negative when the block starts below the top, for example a
// heading pinned below a sticky header). captureAnchor takes the block at the
// top of the viewport (engine.js also anchors on the block that was at the top
// before a scroll, or on the target of a jump). When blocks above it change
// height, putting the viewport back at the same distance from the anchor
// block's top keeps the text from jumping.

export function captureAnchor(layout, scrollTop) {
  const index = layout.indexAt(scrollTop);
  return { index, offset: scrollTop - layout.offsetOf(index) };
}

export function scrollTopFor(layout, anchor) {
  return layout.offsetOf(anchor.index) + anchor.offset;
}
