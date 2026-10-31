import { forwardRef, memo, useEffect, useRef } from 'react';
import { useRouter } from '@tanstack/react-router';

/**
 * The story's sanitized HTML from the server. It stays memoized because the
 * highlight layer edits this DOM directly, and React must not re-render over it.
 */
export const StoryBody = memo(
  forwardRef<HTMLDivElement, { html: string }>(function StoryBody({ html }, forwarded) {
    const router = useRouter();
    const local = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
      const element = local.current;
      if (!element) return;
      const onClick = (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        // Third-party embeds load only when asked for.
        const embed = target.closest<HTMLElement>('.story-embed[data-embed-src]');
        if (embed && !event.metaKey && !event.ctrlKey) {
          event.preventDefault();
          const frame = document.createElement('iframe');
          frame.src = embed.dataset.embedSrc!;
          frame.title = embed.dataset.embedTitle ?? 'Embedded content';
          frame.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture';
          frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
          frame.setAttribute(
            'sandbox',
            'allow-scripts allow-same-origin allow-popups allow-presentation'
          );
          embed.replaceChildren(frame);
          return;
        }
        // Internal links stay inside the app.
        const link = target.closest<HTMLAnchorElement>('a[href^="/"]');
        if (link && !event.metaKey && !event.ctrlKey && !event.shiftKey) {
          event.preventDefault();
          router.history.push(link.getAttribute('href')!);
        }
      };
      element.addEventListener('click', onClick);
      return () => element.removeEventListener('click', onClick);
    }, [router]);

    return (
      <div
        ref={(node) => {
          local.current = node;
          if (typeof forwarded === 'function') forwarded(node);
          else if (forwarded) forwarded.current = node;
        }}
        className='story-body'
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  })
);
