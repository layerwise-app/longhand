import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { EditorBar, type SaveState } from '~/components/editor/editor-bar';
import { StoryEditor, type EditorSnapshot } from '~/components/editor/story-editor';
import { LogoMark } from '~/components/site/logo';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '~/components/ui/dialog';
import { readTryDraft, TRY_DRAFT_KEY, tryImportPath } from '~/components/editor/try-draft';
import { prepareImage, toDataUrl } from '~/lib/image-client';
import { emptyDoc } from '~/lib/story-doc';
import { toast } from 'sonner';

/**
 * The live demo's editor, with no account and no server. Everything stays in this
 * browser until the visitor signs up, when the draft moves into their account.
 */
export default function TryEditor() {
  const [initial] = useState<EditorSnapshot>(
    () => readTryDraft() ?? { title: '', subtitle: '', doc: emptyDoc() }
  );
  const [state, setState] = useState<SaveState>(() => (readTryDraft() ? 'local' : 'idle'));
  const [askOpen, setAskOpen] = useState(false);
  const warned = useRef(false);
  const hasContent = useRef(Boolean(readTryDraft()));
  const [wrote, setWrote] = useState(hasContent.current);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const onChange = useCallback((snapshot: EditorSnapshot) => {
    setWrote(true);
    setState('saving');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try {
        window.localStorage.setItem(TRY_DRAFT_KEY, JSON.stringify(snapshot));
        warned.current = false;
        setState('local');
      } catch {
        setState('idle');
        if (!warned.current) {
          warned.current = true;
          toast.error('Your browser’s storage is full. Remove an image, or sign up to keep going.');
        }
      }
    }, 300);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  const upload = useCallback(async (file: File) => {
    // Small enough to live in browser storage until the writer signs up.
    const prepared = await prepareImage(file, { maxSide: 1200, quality: 0.78 });
    return {
      src: await toDataUrl(prepared.blob),
      width: prepared.width,
      height: prepared.height
    };
  }, []);

  const signUpSearch = useMemo(() => ({ redirect: tryImportPath }), []);

  return (
    <div className='min-h-dvh'>
      <EditorBar state={state}>
        <Button asChild variant='ghost' size='sm' className='hidden rounded-full sm:inline-flex'>
          <Link to='/sign-in' search={signUpSearch}>Sign in</Link>
        </Button>
        <Button size='sm' className='rounded-full' onClick={() => setAskOpen(true)}>
          Publish
        </Button>
      </EditorBar>
      <StoryEditor initial={initial} upload={upload} onChange={onChange}>
        <div className='mb-8 rounded-lg bg-tint px-4 py-3 text-sm leading-snug'>
          <strong className='font-medium'>You’re trying the editor.</strong>{' '}
          This draft stays in this browser and nothing is uploaded.{' '}
          <Link to='/sign-up' search={signUpSearch} className='font-medium whitespace-nowrap underline underline-offset-2'>
            Sign up to keep it
          </Link>
        </div>
      </StoryEditor>
      <Dialog open={askOpen} onOpenChange={setAskOpen}>
        <DialogContent className='max-w-sm text-center'>
          <DialogHeader className='items-center text-center'>
            <LogoMark className='size-10 text-primary' />
            <DialogTitle className='font-display text-2xl font-medium'>
              {wrote ? 'Your draft comes with you' : 'Publishing takes an account'}
            </DialogTitle>
            <DialogDescription>
              Create a free account to publish. Everything you’ve written here, images included, moves over and stays saved.
            </DialogDescription>
          </DialogHeader>
          <div className='flex flex-col gap-2'>
            <Button asChild className='rounded-full'>
              <Link to='/sign-up' search={signUpSearch}>Sign up and keep my draft</Link>
            </Button>
            <Button asChild variant='ghost' className='rounded-full'>
              <Link to='/sign-in' search={signUpSearch}>I already have an account</Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
