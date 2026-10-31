import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { MoreHorizontalIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthGate } from '~/components/site/auth-gate';
import { UserAvatar } from '~/components/site/user-avatar';
import { ReportDialog } from '~/components/story/report-dialog';
import { Button } from '~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '~/components/ui/dropdown-menu';
import {
  addResponse,
  deleteResponse,
  editResponse
} from '~/functions/community.functions';
import type { ResponseItem } from '~/functions/reading.functions';
import { formatDate, plural } from '~/lib/format';
import { limits } from '~/lib/limits';
import { cn } from '~/lib/utils';
import { useViewer } from '~/lib/viewer';

const MAX_INDENT = 3;

function ResponseBody({ text }: { text: string }) {
  const parts = text.split(/\n{2,}/);
  return (
    <div className='space-y-2 font-serif text-[1.08rem] leading-[1.5] break-words'>
      {parts.map((part, index) =>
        part.startsWith('> ') ? (
          <blockquote key={index} className='border-l-2 border-primary pl-3 text-muted-foreground italic'>
            {part.replace(/^> /gm, '')}
          </blockquote>
        ) : (
          <p key={index} className='whitespace-pre-wrap'>{part}</p>
        )
      )}
    </div>
  );
}

function Composer({
  placeholder,
  submitLabel,
  value,
  onChange,
  onSubmit,
  onCancel,
  autoFocus
}: {
  placeholder: string;
  submitLabel: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => Promise<void>;
  onCancel?: () => void;
  autoFocus?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!value.trim() || busy) return;
    setBusy(true);
    try {
      await onSubmit();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'That didn’t go through. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className='rounded-lg border bg-surface p-3 focus-within:border-muted-foreground'>
      <textarea
        value={value}
        autoFocus={autoFocus}
        rows={3}
        maxLength={limits.responseMax}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) void submit();
        }}
        className='block w-full resize-y bg-transparent font-serif text-[1.08rem] leading-snug outline-none placeholder:text-muted-foreground'
      />
      <div className='mt-2 flex items-center justify-end gap-2'>
        {onCancel ? (
          <Button variant='ghost' size='sm' className='rounded-full' onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button
          size='sm'
          className='rounded-full'
          disabled={!value.trim() || busy}
          onClick={submit}
        >
          {busy ? 'Posting…' : submitLabel}
        </Button>
      </div>
    </div>
  );
}

export function Responses({
  storyId,
  authorId,
  initial,
  seed,
  onCountChange
}: {
  storyId: string;
  authorId: string;
  initial: ResponseItem[];
  seed: { text: string; at: number } | null;
  onCountChange: (delta: number) => void;
}) {
  const viewer = useViewer();
  const gate = useAuthGate();
  const [items, setItems] = useState(initial);
  const [draft, setDraft] = useState('');
  const composerWrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!seed) return;
    setDraft((current) => `${seed.text}${current}`);
    composerWrap.current?.querySelector('textarea')?.focus({ preventScroll: true });
  }, [seed]);

  const children = useMemo(() => {
    const map = new Map<string | null, ResponseItem[]>();
    for (const item of items) {
      map.set(item.parentId, [...(map.get(item.parentId) ?? []), item]);
    }
    return map;
  }, [items]);

  const live = items.filter((item) => !item.deleted).length;

  const post = async (body: string, parentId: string | null) => {
    const created = await addResponse({ data: { storyId, parentId, body } });
    setItems((current) => [...current, created]);
    onCountChange(1);
  };

  const replaceItem = (id: string, patch: Partial<ResponseItem>) =>
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );

  const renderThread = (item: ResponseItem, depth: number): React.ReactNode => (
    <ResponseNode
      key={item.id}
      item={item}
      depth={depth}
      isStoryAuthor={item.author.id === authorId}
      viewerId={viewer?.id ?? null}
      onReply={(body) => post(body, item.id)}
      onEdited={(body) => replaceItem(item.id, { body, edited: true })}
      onDeleted={() => {
        replaceItem(item.id, { deleted: true, body: '', author: { ...item.author, name: 'Removed', avatarUrl: null } });
        onCountChange(-1);
      }}
    >
      {(children.get(item.id) ?? []).map((child) => renderThread(child, depth + 1))}
    </ResponseNode>
  );

  return (
    <section id='responses' aria-labelledby='responses-title' className='scroll-mt-20 py-10'>
      <h2 id='responses-title' className='font-display text-2xl font-medium'>
        {live ? plural(live, 'response') : 'Responses'}
      </h2>
      <div ref={composerWrap} className='mt-5'>
        {viewer?.username ? (
          <Composer
            placeholder='What are your thoughts?'
            submitLabel='Respond'
            value={draft}
            onChange={setDraft}
            onSubmit={async () => {
              await post(draft, null);
              setDraft('');
            }}
          />
        ) : (
          <button
            type='button'
            onClick={() => gate('respond to this story')}
            className='block w-full rounded-lg border bg-surface p-4 text-left font-serif text-[1.08rem] text-muted-foreground hover:border-muted-foreground'
          >
            What are your thoughts?
          </button>
        )}
      </div>
      <div className='mt-8 space-y-7'>
        {(children.get(null) ?? []).slice().reverse().map((item) => renderThread(item, 0))}
        {!items.length ? (
          <p className='font-serif text-lg text-muted-foreground'>No responses yet. You could be the first.</p>
        ) : null}
      </div>
    </section>
  );
}

function ResponseNode({
  item,
  depth,
  isStoryAuthor,
  viewerId,
  onReply,
  onEdited,
  onDeleted,
  children
}: {
  item: ResponseItem;
  depth: number;
  isStoryAuthor: boolean;
  viewerId: string | null;
  onReply: (body: string) => Promise<void>;
  onEdited: (body: string) => void;
  onDeleted: () => void;
  children: React.ReactNode;
}) {
  const gate = useAuthGate();
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(item.body);
  const own = viewerId === item.author.id;
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);

  if (item.deleted && !hasChildren) return null;

  return (
    <div id={`response-${item.id}`} className='scroll-mt-20'>
      {item.deleted ? (
        <p className='text-sm text-muted-foreground italic'>This response was removed by its author.</p>
      ) : (
        <>
          <div className='flex items-center gap-2.5'>
            <Link to='/@{$username}' params={{ username: item.author.username }} tabIndex={-1} aria-hidden='true'>
              <UserAvatar name={item.author.name} src={item.author.avatarUrl} size={32} />
            </Link>
            <div className='min-w-0 flex-1 leading-tight'>
              <Link
                to='/@{$username}'
                params={{ username: item.author.username }}
                className='text-sm font-medium hover:underline'
              >
                {item.author.name}
              </Link>
              {isStoryAuthor ? (
                <span className='ml-1.5 rounded-sm bg-tint px-1.5 py-0.5 text-[11px] text-muted-foreground'>Author</span>
              ) : null}
              <div className='text-[12px] text-muted-foreground'>
                {formatDate(item.createdAt)}
                {item.edited ? ' · edited' : ''}
              </div>
            </div>
            <ReportDialog
              targetType='response'
              targetId={item.id}
              trigger={(openReport) => (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label='More actions for this response'
                    className='inline-flex size-8 items-center justify-center rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50'
                  >
                    <MoreHorizontalIcon className='size-4' />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align='end'>
                    {own ? (
                      <>
                        <DropdownMenuItem
                          onSelect={() => {
                            setEditText(item.body);
                            setEditing(true);
                          }}
                        >
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant='destructive'
                          onSelect={async () => {
                            try {
                              await deleteResponse({ data: { id: item.id } });
                              onDeleted();
                            } catch (error) {
                              toast.error(error instanceof Error ? error.message : 'Couldn’t remove that.');
                            }
                          }}
                        >
                          Delete
                        </DropdownMenuItem>
                      </>
                    ) : (
                      <DropdownMenuItem onSelect={openReport}>Report</DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            />
          </div>
          <div className='mt-2'>
            {editing ? (
              <Composer
                autoFocus
                placeholder='Edit your response'
                submitLabel='Save'
                value={editText}
                onChange={setEditText}
                onCancel={() => setEditing(false)}
                onSubmit={async () => {
                  const saved = await editResponse({ data: { id: item.id, body: editText } });
                  onEdited(saved.body);
                  setEditing(false);
                }}
              />
            ) : (
              <ResponseBody text={item.body} />
            )}
          </div>
          {editing ? null : (
            <button
              type='button'
              className='mt-1.5 text-[13px] text-muted-foreground hover:text-foreground'
              onClick={() => {
                if (gate('reply to this response')) setReplying((value) => !value);
              }}
            >
              Reply
            </button>
          )}
          {replying ? (
            <div className='mt-3'>
              <Composer
                autoFocus
                placeholder={`Reply to ${item.author.name}`}
                submitLabel='Reply'
                value={replyText}
                onChange={setReplyText}
                onCancel={() => setReplying(false)}
                onSubmit={async () => {
                  await onReply(replyText);
                  setReplyText('');
                  setReplying(false);
                }}
              />
            </div>
          ) : null}
        </>
      )}
      {hasChildren ? (
        <div
          className={cn(
            'mt-5 space-y-5',
            depth < MAX_INDENT && 'border-l pl-4 sm:pl-5'
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
