import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { LogoMark } from '~/components/site/logo';
import { ShortcutsHelp } from '~/components/editor/shortcuts-help';

export type SaveState =
  | 'idle'
  | 'dirty'
  | 'saving'
  | 'saved'
  | 'local'
  | 'offline'
  | 'conflict';

const LABELS: Record<SaveState, string> = {
  idle: '',
  dirty: 'Saving…',
  saving: 'Saving…',
  saved: 'Saved',
  local: 'Saved in this browser',
  offline: 'Saved on this device. We’ll sync when you’re back online.',
  conflict: 'Edited somewhere else'
};

export function EditorBar({
  state,
  homeTo = '/',
  children
}: {
  state: SaveState;
  homeTo?: '/' | '/dashboard';
  children: ReactNode;
}) {
  return (
    <header className='sticky top-0 z-20 border-b border-transparent bg-background/95 backdrop-blur-sm'>
      <div className='mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6'>
        <Link to={homeTo} aria-label='Leave the editor'>
          <LogoMark className='size-7 text-primary' />
        </Link>
        <p
          role='status'
          aria-live='polite'
          data-save-state={state}
          className='min-w-0 truncate text-[13px] text-muted-foreground'
        >
          {LABELS[state]}
        </p>
        <div className='ml-auto flex shrink-0 items-center gap-1 sm:gap-2'>
          <ShortcutsHelp />
          {children}
        </div>
      </div>
    </header>
  );
}
