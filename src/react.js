import {
  createElement as h,
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import { flushSync } from 'react-dom';

import { PageWindow } from './engine.js';
import { Layout } from './layout.js';

// A scroll container that mounts only the blocks near the viewport.
//
//   blocks      the content of each block (anything renderBlock understands)
//   estimates   a guess of each block's height in px, until it is measured
//   ids         the anchor id of each block, or null
//   height      height of the scroll container in px
//   renderBlock (block, index) => node
//
// The window is rebuilt when estimates, ids, height, overscan or anchoring
// change, which forgets the measured heights; keep those props stable.
// Through `ref` the parent gets { page, scrollToId, scrollToBlock }.

export const WindowedPage = forwardRef(function WindowedPage(
  { blocks, estimates, ids, height, overscan = 3, anchoring = true, nativeAnchor = false, renderBlock, className, style },
  ref
) {
  const scroller = useRef(null);
  const pending = useRef(null);
  const observer = useRef(null);
  const [, bump] = useReducer((n) => n + 1, 0);

  const page = useMemo(
    () => new PageWindow({ layout: new Layout(estimates), viewport: height, overscan, anchoring, ids }),
    [estimates, ids, height, overscan, anchoring]
  );

  const mounted = () => scroller.current.querySelectorAll('[data-index]');

  // The browser can move scrollTop before its scroll event reaches us. A
  // measurement taken in that gap would otherwise be corrected from the old
  // position and would undo the user's scroll, so tell the window first.
  const syncScroll = () => page.scrollTo(scroller.current.scrollTop);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (pending.current !== null) {
      if (Math.abs(el.scrollTop - pending.current) >= 1) el.scrollTop = pending.current;
      pending.current = null;
    }
    syncScroll();
    const entries = [];
    for (const node of mounted()) {
      const index = Number(node.dataset.index);
      if (!page.layout.isMeasured(index)) entries.push([index, node.getBoundingClientRect().height]);
    }
    if (entries.length > 0) {
      pending.current = page.measure(entries);
      bump();
    }
  });

  useLayoutEffect(() => {
    const watcher = new ResizeObserver((records) => {
      const entries = [];
      for (const record of records) {
        // A block that was just unmounted reports a height of 0.
        if (!record.target.isConnected) continue;
        const index = Number(record.target.dataset.index);
        const size = record.target.getBoundingClientRect().height;
        if (Math.abs(size - page.layout.height(index)) >= 0.5) entries.push([index, size]);
      }
      if (entries.length === 0) return;
      syncScroll();
      pending.current = page.measure(entries);
      flushSync(bump);
    });
    observer.current = watcher;
    return () => watcher.disconnect();
  }, [page]);

  useLayoutEffect(() => {
    for (const node of mounted()) observer.current.observe(node);
  });

  const jump = (result) => {
    if (!result) return null;
    pending.current = result.scrollTop;
    flushSync(bump);
    return result;
  };

  useImperativeHandle(
    ref,
    () => ({
      page,
      scrollToId: (id, margin) => jump(page.scrollToId(id, margin)),
      scrollToBlock: (index, margin) => jump(page.scrollToBlock(index, margin)),
    }),
    [page]
  );

  const onScroll = () => {
    const before = page.range();
    page.scrollTo(scroller.current.scrollTop);
    const after = page.range();
    if (before.start !== after.start || before.end !== after.end) flushSync(bump);
  };

  const { start, end } = page.range();
  const gap = page.spacers();
  const children = [h('div', { key: 'before', 'aria-hidden': true, style: { height: gap.before } })];
  for (let i = start; i < end; i++) {
    children.push(h('div', { key: i, 'data-index': i, style: { display: 'flow-root' } }, renderBlock(blocks[i], i)));
  }
  children.push(h('div', { key: 'after', 'aria-hidden': true, style: { height: gap.after } }));

  return h(
    'div',
    {
      ref: scroller,
      onScroll,
      className,
      style: { height, overflowY: 'auto', overflowAnchor: nativeAnchor ? 'auto' : 'none', ...style },
    },
    children
  );
});
