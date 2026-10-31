import { useCallback, useEffect, useRef, useState } from 'react';
import { HighlighterIcon, MessageSquareIcon, XIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthGate } from '~/components/site/auth-gate';
import { addHighlight, removeHighlight } from '~/functions/community.functions';
import { limits } from '~/lib/limits';
import { plural } from '~/lib/format';

const BLOCKS = 'p, li, h2, h3, blockquote, figcaption';

/** Wraps the first match of `quote` in a mark, across any inline formatting. */
function markQuote(
  root: HTMLElement,
  quote: string,
  attributes: Record<string, string>
): HTMLElement | null {
  for (const block of root.querySelectorAll<HTMLElement>('p, h2, h3, figcaption')) {
    const text = block.textContent ?? '';
    const start = text.indexOf(quote);
    if (start < 0) continue;
    const end = start + quote.length;
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    const nodes: { node: Text; from: number; to: number }[] = [];
    let offset = 0;
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      const length = node.data.length;
      if (offset + length > start && offset < end) {
        nodes.push({ node, from: Math.max(0, start - offset), to: Math.min(length, end - offset) });
      }
      offset += length;
    }
    for (const { node, from, to } of nodes) {
      const middle = node.splitText(from);
      middle.splitText(to - from);
      const mark = document.createElement('mark');
      mark.className = 'story-mark';
      for (const [name, value] of Object.entries(attributes)) mark.setAttribute(name, value);
      middle.parentNode!.replaceChild(mark, middle);
      mark.appendChild(middle);
    }
    return block;
  }
  return null;
}

function unmark(root: HTMLElement, id: string) {
  root.querySelectorAll(`mark[data-highlight-id="${CSS.escape(id)}"]`).forEach((mark) => {
    const parent = mark.parentNode!;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
    parent.normalize();
  });
}

type Popover =
  | { kind: 'selection'; quote: string; x: number; y: number }
  | { kind: 'mine'; id: string; x: number; y: number };

/** On phones the browser's own menu sits above a selection, so go below. */
function popoverTop(rect: DOMRect, coarse: boolean) {
  if (coarse) return Math.min(rect.bottom + 12, window.innerHeight - 112);
  return Math.max(rect.top - 8, 64);
}

const clean = (value: string) => value.replace(/\s+/g, ' ').trim();

/** The selected text, clipped to the block the selection started in. */
function selectionQuote(root: HTMLElement) {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.rangeCount) return null;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return null;
  const startEl =
    range.startContainer instanceof Element
      ? range.startContainer
      : range.startContainer.parentElement;
  const block = startEl?.closest(BLOCKS);
  if (!block || !root.contains(block) || startEl?.closest('pre')) return null;
  let quote = '';
  if (block.contains(range.endContainer)) {
    quote = range.toString();
  } else {
    const clipped = range.cloneRange();
    clipped.setEndAfter(block.lastChild!);
    quote = clipped.toString();
  }
  quote = clean(quote);
  if (quote.length < 3) return null;
  const rect = range.getBoundingClientRect();
  return { quote: quote.slice(0, limits.highlightMax), rect };
}

/**
 * Marks the shared most-highlighted passage and the reader's own highlights, and
 * shows the small toolbar when text is selected. Everything is found by quoting
 * the text, so highlights survive the writer fixing a typo elsewhere.
 */
export function HighlightLayer({
  bodyRef,
  storyId,
  top,
  mine,
  onRespond
}: {
  bodyRef: React.RefObject<HTMLDivElement | null>;
  storyId: string;
  top: { quote: string; count: number } | null;
  mine: { id: string; quote: string }[];
  onRespond: (quote: string) => void;
}) {
  const gate = useAuthGate();
  const [popover, setPopover] = useState<Popover | null>(null);
  const applied = useRef(false);
  const coarse = useRef(false);

  useEffect(() => {
    coarse.current = window.matchMedia('(pointer: coarse)').matches;
    const root = bodyRef.current;
    if (!root || applied.current) return;
    applied.current = true;
    if (top) {
      const block = markQuote(root, top.quote, {
        'data-kind': 'top',
        title: `${plural(top.count, 'reader')} highlighted this`
      });
      if (block) {
        block.dataset.topNote = `Top highlight · ${plural(top.count, 'reader')}`;
      }
    }
    for (const highlight of mine) {
      markQuote(root, highlight.quote, {
        'data-kind': 'mine',
        'data-highlight-id': highlight.id,
        tabindex: '0',
        role: 'button',
        'aria-label': 'Your highlight. Press to remove it.'
      });
    }
  }, [bodyRef, mine, top]);

  const update = useCallback(() => {
    const root = bodyRef.current;
    if (!root) return;
    const found = selectionQuote(root);
    if (!found) {
      setPopover((current) => (current?.kind === 'selection' ? null : current));
      return;
    }
    setPopover({
      kind: 'selection',
      quote: found.quote,
      x: found.rect.left + found.rect.width / 2,
      y: popoverTop(found.rect, coarse.current)
    });
  }, [bodyRef]);

  useEffect(() => {
    const root = bodyRef.current;
    if (!root) return;
    let timer: ReturnType<typeof setTimeout>;
    const onSelection = () => {
      clearTimeout(timer);
      timer = setTimeout(update, coarse.current ? 250 : 80);
    };
    const onClick = (event: MouseEvent) => {
      const mark = (event.target as HTMLElement).closest<HTMLElement>('mark[data-highlight-id]');
      if (!mark || !window.getSelection()?.isCollapsed) return;
      const rect = mark.getBoundingClientRect();
      setPopover({
        kind: 'mine',
        id: mark.dataset.highlightId!,
        x: rect.left + rect.width / 2,
        y: popoverTop(rect, coarse.current)
      });
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPopover(null);
    };
    const onScroll = () => {
      setPopover((current) => (current?.kind === 'mine' ? null : current));
      update();
    };
    document.addEventListener('selectionchange', onSelection);
    document.addEventListener('keydown', onKey);
    root.addEventListener('click', onClick);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      clearTimeout(timer);
      document.removeEventListener('selectionchange', onSelection);
      document.removeEventListener('keydown', onKey);
      root.removeEventListener('click', onClick);
      window.removeEventListener('scroll', onScroll);
    };
  }, [bodyRef, update]);

  if (!popover) return null;

  const highlight = async () => {
    if (popover.kind !== 'selection') return;
    if (!gate('highlight passages')) return;
    const quote = popover.quote;
    setPopover(null);
    window.getSelection()?.removeAllRanges();
    try {
      const saved = await addHighlight({ data: { storyId, quote } });
      const root = bodyRef.current;
      if (root && !root.querySelector(`mark[data-highlight-id="${CSS.escape(saved.id)}"]`)) {
        markQuote(root, saved.quote, {
          'data-kind': 'mine',
          'data-highlight-id': saved.id,
          tabindex: '0',
          role: 'button',
          'aria-label': 'Your highlight. Press to remove it.'
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Couldn’t save that highlight.');
    }
  };

  const remove = async () => {
    if (popover.kind !== 'mine') return;
    const { id } = popover;
    setPopover(null);
    try {
      await removeHighlight({ data: { id } });
      if (bodyRef.current) unmark(bodyRef.current, id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Couldn’t remove that highlight.');
    }
  };

  const buttonClass =
    'inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium whitespace-nowrap hover:bg-background/15';

  return (
    <div
      role='toolbar'
      aria-label='Selection actions'
      // Keeps the selection alive when the buttons are pressed.
      onMouseDown={(event) => event.preventDefault()}
      className='fixed z-40 flex gap-0.5 rounded-full bg-foreground p-0.5 text-background shadow-lg'
      style={{
        left: Math.max(100, Math.min(popover.x, (typeof window === 'undefined' ? 800 : window.innerWidth) - 100)),
        top: popover.y,
        transform: coarse.current
          ? 'translateX(-50%)'
          : 'translate(-50%, -100%)'
      }}
    >
      {popover.kind === 'selection' ? (
        <>
          <button type='button' className={buttonClass} onClick={highlight}>
            <HighlighterIcon className='size-4' /> Highlight
          </button>
          <button
            type='button'
            className={buttonClass}
            onClick={() => {
              const quote = popover.quote;
              setPopover(null);
              window.getSelection()?.removeAllRanges();
              onRespond(quote);
            }}
          >
            <MessageSquareIcon className='size-4' /> Respond
          </button>
        </>
      ) : (
        <button type='button' className={buttonClass} onClick={remove}>
          <XIcon className='size-4' /> Remove highlight
        </button>
      )}
    </div>
  );
}
