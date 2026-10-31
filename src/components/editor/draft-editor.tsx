import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useRouter } from '@tanstack/react-router';
import { EllipsisIcon, RefreshCwIcon } from 'lucide-react';
import { toast } from 'sonner';
import { EditorBar, type SaveState } from '~/components/editor/editor-bar';
import { PublishDialog } from '~/components/editor/publish-dialog';
import { StoryEditor, type EditorSnapshot } from '~/components/editor/story-editor';
import { Button } from '~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '~/components/ui/dropdown-menu';
import {
  createDraft,
  saveDraft,
  unpublishStory,
  uploadImage,
  type DraftData
} from '~/functions/stories.functions';
import type { ViewerWithUnread } from '~/functions/viewer.functions';
import { prepareImage } from '~/lib/image-client';
import { emptyDoc } from '~/lib/story-doc';

const localKey = (id: string) => `longhand:draft:${id}`;

type LocalCopy = EditorSnapshot & { baseRevision: number };

function readLocal(id: string): LocalCopy | null {
  try {
    const raw = window.localStorage.getItem(localKey(id));
    return raw ? (JSON.parse(raw) as LocalCopy) : null;
  } catch {
    return null;
  }
}

function writeLocal(id: string, copy: LocalCopy) {
  try {
    window.localStorage.setItem(localKey(id), JSON.stringify(copy));
  } catch {
    // Full or blocked. The server copy is still the real one.
  }
}

function clearLocal(id: string) {
  try {
    window.localStorage.removeItem(localKey(id));
  } catch {
    // Nothing to clear.
  }
}

const SAVE_DELAY = 900;

/**
 * Edits are written to this browser immediately and to the server shortly after,
 * so a closed tab or a dropped connection can't lose work. On the next open, an
 * unsaved local copy wins as long as it was based on the current server version.
 */
export default function DraftEditor({
  draft,
  viewer
}: {
  draft: DraftData | null;
  viewer: ViewerWithUnread;
}) {
  const router = useRouter();
  const [initial] = useState<EditorSnapshot>(() => {
    const server: EditorSnapshot = {
      title: draft?.draftTitle ?? '',
      subtitle: draft?.draftSubtitle ?? '',
      doc: draft?.draftDoc ?? emptyDoc()
    };
    const local = readLocal(draft?.id ?? 'new');
    if (!local) return server;
    if (!draft || local.baseRevision === draft.revision) return local;
    // Saved somewhere newer since this copy was made, so the server wins.
    clearLocal(draft.id);
    return server;
  });
  const hasRecovered = useRef(
    Boolean(readLocal(draft?.id ?? 'new')) &&
      (!draft || readLocal(draft.id)?.baseRevision === draft.revision)
  );
  const [state, setState] = useState<SaveState>('idle');
  const [storyId, setStoryId] = useState(draft?.id ?? null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishSnapshot, setPublishSnapshot] = useState<EditorSnapshot>(initial);
  const revision = useRef(draft?.revision ?? 0);
  const idRef = useRef(draft?.id ?? null);
  const latest = useRef<EditorSnapshot>(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const saving = useRef(false);
  const dirty = useRef(false);
  const conflict = useRef(false);
  const editorApi = useRef<{ snapshot: () => EditorSnapshot; hasPendingUploads: () => boolean } | null>(null);

  const flush = useCallback(async (): Promise<void> => {
    clearTimeout(timer.current);
    if (saving.current || !dirty.current || conflict.current) return;
    if (editorApi.current?.hasPendingUploads()) {
      timer.current = setTimeout(flush, SAVE_DELAY);
      return;
    }
    saving.current = true;
    dirty.current = false;
    const snapshot = editorApi.current?.snapshot() ?? latest.current;
    setState('saving');
    try {
      if (!idRef.current) {
        // The first real keystroke creates the draft, so "Write" leaves no empties.
        const created = await createDraft({ data: snapshot });
        idRef.current = created.id;
        revision.current = created.revision;
        setStoryId(created.id);
        clearLocal('new');
        // Swap the address without a navigation: the editor must keep focus.
        window.history.replaceState(window.history.state, '', `/dashboard/write/${created.id}`);
      } else {
        const result = await saveDraft({
          data: {
            id: idRef.current,
            baseRevision: revision.current,
            ...snapshot
          }
        });
        if (!result.ok) {
          conflict.current = true;
          setState('conflict');
          return;
        }
        revision.current = result.revision;
      }
      if (dirty.current) {
        writeLocal(idRef.current, { ...latest.current, baseRevision: revision.current });
        timer.current = setTimeout(flush, SAVE_DELAY);
      } else {
        clearLocal(idRef.current);
        setState('saved');
      }
    } catch {
      dirty.current = true;
      setState('offline');
      timer.current = setTimeout(flush, 5000);
    } finally {
      saving.current = false;
    }
  }, []);

  const onChange = useCallback(
    (snapshot: EditorSnapshot) => {
      latest.current = snapshot;
      dirty.current = true;
      if (conflict.current) return;
      writeLocal(idRef.current ?? 'new', { ...snapshot, baseRevision: revision.current });
      setState((current) => (current === 'offline' ? current : 'dirty'));
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, SAVE_DELAY);
    },
    [flush]
  );

  useEffect(() => {
    // A recovered copy still has to reach the server.
    if (hasRecovered.current) {
      dirty.current = true;
      setState('dirty');
      timer.current = setTimeout(flush, 300);
    } else if (draft) {
      setState('saved');
    }
    const flushNow = () => void flush();
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushNow();
    };
    window.addEventListener('online', flushNow);
    window.addEventListener('pagehide', flushNow);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearTimeout(timer.current);
      window.removeEventListener('online', flushNow);
      window.removeEventListener('pagehide', flushNow);
      document.removeEventListener('visibilitychange', onVisibility);
      flushNow();
    };
  }, [draft, flush]);

  const upload = useCallback(async (file: File) => {
    const prepared = await prepareImage(file);
    const form = new FormData();
    form.set('file', new File([prepared.blob], prepared.name, { type: prepared.blob.type }));
    const { url } = await uploadImage({ data: form });
    return { src: url, width: prepared.width, height: prepared.height };
  }, []);

  const ensureSaved = useCallback(async () => {
    dirty.current = true;
    while (saving.current) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    await flush();
    if (!idRef.current) throw new Error('We couldn’t save your draft. Please try again.');
    if (conflict.current) {
      throw new Error('This draft changed somewhere else. Reload the page to get the latest version.');
    }
    return idRef.current;
  }, [flush]);

  const isPublished = draft?.status === 'published';

  const unpublish = async () => {
    if (!idRef.current) return;
    try {
      await unpublishStory({ data: { id: idRef.current } });
      toast.success('Unpublished. It’s back in your drafts.');
      router.navigate({ to: '/dashboard' });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'That didn’t work.');
    }
  };

  return (
    <div className='min-h-dvh'>
      <EditorBar state={state} homeTo='/dashboard'>
        <Button
          size='sm'
          className='rounded-full'
          onClick={() => {
            const snapshot = editorApi.current?.snapshot() ?? latest.current;
            setPublishSnapshot(snapshot);
            if (!snapshot.title.trim()) {
              toast('Give your story a title first.');
              return;
            }
            void ensureSaved()
              .then(() => setPublishOpen(true))
              .catch((error: Error) => toast.error(error.message));
          }}
        >
          {isPublished ? 'Update' : 'Publish'}
        </Button>
        {isPublished ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label='More actions'
              className='inline-flex size-9 items-center justify-center rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50'
            >
              <EllipsisIcon className='size-5' />
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              <DropdownMenuItem asChild>
                <Link to='/story/$slug' params={{ slug: draft.slug! }}>View story</Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={unpublish}>Unpublish</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </EditorBar>
      {state === 'conflict' ? (
        <div className='mx-auto max-w-[42rem] px-5 pt-4'>
          <div className='flex items-center gap-3 rounded-lg bg-tint p-3 text-sm'>
            <p className='flex-1'>This draft was changed in another tab or on another device. Reload to get the latest version.</p>
            <Button size='sm' variant='outline' className='shrink-0 rounded-full bg-transparent' onClick={() => { clearLocal(idRef.current ?? 'new'); window.location.reload(); }}>
              <RefreshCwIcon className='size-4' /> Reload
            </Button>
          </div>
        </div>
      ) : null}
      <StoryEditor
        initial={initial}
        upload={upload}
        onChange={onChange}
        onEditorReady={(api) => {
          editorApi.current = api;
        }}
      />
      <PublishDialog
        key={publishOpen ? 'open' : 'closed'}
        open={publishOpen}
        onOpenChange={setPublishOpen}
        storyId={storyId}
        snapshot={publishSnapshot}
        isUpdate={isPublished}
        viewer={viewer}
        defaults={{
          description: draft?.description ?? '',
          coverUrl: draft?.coverUrl ?? null,
          coverAlt: draft?.coverAlt ?? '',
          topics: draft?.topics ?? []
        }}
        beforePublish={ensureSaved}
        onPublished={(slug) => {
          if (idRef.current) clearLocal(idRef.current);
          clearLocal('new');
          router.navigate({ to: '/story/$slug', params: { slug } });
        }}
      />
    </div>
  );
}
