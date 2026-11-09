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
import { canMeasure, entriesFromRecords, measureAt } from './measure.js';

// A scroll container that mounts only the blocks near the viewport.
//
//   blocks      the content of each block (anything renderBlock understands)
//   estimates   a guess of each block's height in px, until it is measured
//   ids         the anchor id of each block, or null
//   height      height of the scroll container in px
//   renderBlock (block, index) => node
//
// The measured heights are kept until `estimates` changes. A new `ids`,
// `overscan` or `anchoring` builds a new window on the same heights, which
// forgets the scroll position it was tracking, so keep those props stable.
// Through `ref` the parent gets { page, scrollToId, scrollToBlock }.

export const WindowedPage = forwardRef(function WindowedPage(
  { blocks, estimates, ids, height, overscan = 3, anchoring = true, nativeAnchor = false, renderBlock, className, style },
  ref
) {
  const scroller = useRef(null);
  const pending = useRef(null);
  const observer = useRef(null);
  const [, bump] = useReducer((n) => n + 1, 0);

  const layout = useMemo(() => new Layout(estimates), [estimates]);
  const page = useMemo(
    () => new PageWindow({ layout, viewport: height, overscan, anchoring, ids }),
    [layout, overscan, anchoring, ids]
  );
  page.viewport = height;

  const mounted = () => scroller.current.querySelectorAll('[data-index]');

  useLayoutEffect(() => {
    const el = scroller.current;
    if (pending.current !== null) {
      if (Math.abs(el.scrollTop - pending.current) >= 1) el.scrollTop = pending.current;
      pending.current = null;
    }
    const entries = [];
    if (canMeasure(el)) {
      for (const node of mounted()) {
        const index = Number(node.dataset.index);
        if (!page.layout.isMeasured(index)) entries.push([index, node.getBoundingClientRect().height]);
      }
    }
    if (entries.length > 0) {
      pending.current = measureAt(page, el.scrollTop, entries);
      bump();
    } else {
      page.scrollTo(el.scrollTop);
    }
  });

  useLayoutEffect(() => {
    const watcher = new ResizeObserver((records) => {
      const el = scroller.current;
      if (!el || !canMeasure(el)) return;
      const entries = entriesFromRecords(records, page.layout);
      if (entries.length === 0) return;
      pending.current = measureAt(page, el.scrollTop, entries);
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
