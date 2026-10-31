import { useState } from 'react';
import { KeyboardIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '~/components/ui/dialog';

const SHORTCUTS: [string, string][] = [
  ['# then space', 'Heading'],
  ['### then space', 'Subheading'],
  ['> then space', 'Quote'],
  ['- then space', 'Bulleted list'],
  ['1. then space', 'Numbered list'],
  ['``` then space', 'Code block'],
  ['--- on its own line', 'Divider'],
  ['**text**', 'Bold'],
  ['*text*', 'Italic'],
  ['`text`', 'Inline code']
];

export function ShortcutsHelp() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type='button'
        aria-label='Markdown shortcuts'
        title='Markdown shortcuts'
        onClick={() => setOpen(true)}
        className='hidden size-9 items-center justify-center rounded-full text-muted-foreground hover:text-foreground md:inline-flex'
      >
        <KeyboardIcon className='size-[1.15rem]' />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className='max-w-sm'>
          <DialogHeader>
            <DialogTitle>Markdown shortcuts</DialogTitle>
            <DialogDescription>Type these as you write.</DialogDescription>
          </DialogHeader>
          <dl className='grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 text-sm'>
            {SHORTCUTS.map(([keys, label]) => (
              <div key={keys} className='contents'>
                <dt><code className='rounded-sm bg-tint px-1.5 py-0.5 font-mono text-xs'>{keys}</code></dt>
                <dd className='text-muted-foreground'>{label}</dd>
              </div>
            ))}
          </dl>
        </DialogContent>
      </Dialog>
    </>
  );
}
