import { useEffect, useRef } from 'react';

function track(storyId: string, event: 'view' | 'read') {
  const body = JSON.stringify({ storyId, event });
  // sendBeacon survives the reader closing the tab right after finishing.
  const sent = navigator.sendBeacon?.(
    '/api/track',
    new Blob([body], { type: 'application/json' })
  );
  if (!sent) {
    void fetch('/api/track', {
      method: 'POST',
      keepalive: true,
      headers: { 'content-type': 'application/json' },
      body
    });
  }
}

/**
 * The thin bar at the top of the window. It writes to the DOM directly, once per
 * frame at most, so a long story scrolls without any React work at all. It also
 * reports the view, and the read: reaching the end of the story after spending
 * a believable amount of time on it.
 */
export function ReadingProgress({
  targetRef,
  storyId,
  readingMinutes
}: {
  targetRef: React.RefObject<HTMLElement | null>;
  storyId: string;
  readingMinutes: number;
}) {
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    track(storyId, 'view');
    const startedAt = Date.now();
    // A quarter of the estimate: fast readers count, scrollers-to-the-end don't.
    const minimumMs = Math.min(readingMinutes * 60_000 * 0.25, 120_000);
    let read = false;
    let frame = 0;

    const update = () => {
      frame = 0;
      const target = targetRef.current;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      const distance = rect.height - window.innerHeight;
      const progress = distance > 0 ? Math.min(1, Math.max(0, -rect.top / distance)) : 1;
      if (bar.current) bar.current.style.transform = `scaleX(${progress})`;
      if (!read && progress >= 0.85 && Date.now() - startedAt >= minimumMs) {
        read = true;
        track(storyId, 'read');
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    // A slow reader may sit at the end after their last scroll.
    const interval = setInterval(onScroll, 10_000);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      clearInterval(interval);
      cancelAnimationFrame(frame);
    };
  }, [readingMinutes, storyId, targetRef]);

  return (
    <div className='pointer-events-none fixed inset-x-0 top-0 z-50 h-[3px]' aria-hidden='true'>
      <div
        ref={bar}
        className='h-full origin-left bg-primary will-change-transform'
        style={{ transform: 'scaleX(0)' }}
      />
    </div>
  );
}
