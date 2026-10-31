import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import { BubbleMenu, FloatingMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Typography from '@tiptap/extension-typography';
import { Placeholder } from '@tiptap/extensions';
import {
  BoldIcon,
  CodeIcon,
  Code2Icon,
  HeadingIcon,
  ImageIcon,
  ItalicIcon,
  LinkIcon,
  MinusIcon,
  PlusIcon,
  QuoteIcon,
  Trash2Icon,
  TvIcon,
  XIcon
} from 'lucide-react';
import { toast } from 'sonner';
import { Embed, Figure } from '~/components/editor/nodes';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { limits } from '~/lib/limits';
import { parseEmbedUrl, type StoryDoc } from '~/lib/story-doc';
import { cn } from '~/lib/utils';

export type UploadedImage = { src: string; width: number; height: number };
export type EditorSnapshot = { title: string; subtitle: string; doc: StoryDoc };

/** Grows with its text. The title and subtitle are plain text, never markup. */
function AutoTextarea({
  textareaRef,
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const local = useRef<HTMLTextAreaElement | null>(null);
  const fit = useCallback(() => {
    const element = local.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight}px`;
  }, []);
  useEffect(fit, [fit, props.value]);
  useEffect(() => {
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [fit]);
  return (
    <textarea
      {...props}
      rows={1}
      ref={(node) => {
        local.current = node;
        if (textareaRef) textareaRef.current = node;
      }}
      className={cn('title-input block', className)}
    />
  );
}

const toolButton = (active: boolean) =>
  cn(
    'inline-flex size-9 shrink-0 items-center justify-center rounded-md transition-colors',
    active ? 'bg-background/20 text-primary-foreground' : 'hover:bg-background/15'
  );

function useMarks(editor: Editor) {
  return useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current.isActive('bold'),
      italic: current.isActive('italic'),
      code: current.isActive('code'),
      link: current.isActive('link'),
      h2: current.isActive('heading', { level: 2 }),
      h3: current.isActive('heading', { level: 3 }),
      quote: current.isActive('blockquote'),
      inFigure: current.isActive('figure'),
      inCode: current.isActive('codeBlock')
    })
  });
}

function FormatButtons({
  editor,
  onLink,
  buttonClass = toolButton
}: {
  editor: Editor;
  onLink: () => void;
  buttonClass?: (active: boolean) => string;
}) {
  const marks = useMarks(editor);
  // preventDefault keeps the selection in the document when a button is pressed.
  const hold = (event: React.MouseEvent) => event.preventDefault();
  return (
    <>
      <button type='button' aria-label='Bold' aria-pressed={marks.bold} title='Bold' onMouseDown={hold} onClick={() => editor.chain().focus().toggleBold().run()} className={buttonClass(marks.bold)}>
        <BoldIcon className='size-4' />
      </button>
      <button type='button' aria-label='Italic' aria-pressed={marks.italic} title='Italic' onMouseDown={hold} onClick={() => editor.chain().focus().toggleItalic().run()} className={buttonClass(marks.italic)}>
        <ItalicIcon className='size-4' />
      </button>
      <button type='button' aria-label='Link' aria-pressed={marks.link} title='Link' onMouseDown={hold} onClick={onLink} className={buttonClass(marks.link)}>
        <LinkIcon className='size-4' />
      </button>
      <span aria-hidden='true' className='mx-1 h-5 w-px shrink-0 bg-current opacity-25' />
      <button type='button' aria-label='Heading' aria-pressed={marks.h2} title='Heading' onMouseDown={hold} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={buttonClass(marks.h2)}>
        <HeadingIcon className='size-[1.05rem]' />
      </button>
      <button type='button' aria-label='Subheading' aria-pressed={marks.h3} title='Subheading' onMouseDown={hold} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={buttonClass(marks.h3)}>
        <HeadingIcon className='size-3.5' />
      </button>
      <button type='button' aria-label='Quote' aria-pressed={marks.quote} title='Quote' onMouseDown={hold} onClick={() => editor.chain().focus().toggleBlockquote().run()} className={buttonClass(marks.quote)}>
        <QuoteIcon className='size-4' />
      </button>
      <button type='button' aria-label='Inline code' aria-pressed={marks.code} title='Inline code' onMouseDown={hold} onClick={() => editor.chain().focus().toggleCode().run()} className={buttonClass(marks.code)}>
        <CodeIcon className='size-4' />
      </button>
    </>
  );
}

function LinkForm({
  editor,
  onDone,
  className
}: {
  editor: Editor;
  onDone: () => void;
  className?: string;
}) {
  const [value, setValue] = useState(() => editor.getAttributes('link').href ?? '');
  const apply = () => {
    const href = value.trim();
    if (!href) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      const normalized = /^(https?:\/\/|mailto:|\/)/i.test(href) ? href : `https://${href}`;
      editor.chain().focus().extendMarkRange('link').setLink({ href: normalized }).run();
    }
    onDone();
  };
  return (
    <form
      className={cn('flex items-center gap-1', className)}
      onSubmit={(event) => {
        event.preventDefault();
        apply();
      }}
    >
      <input
        autoFocus
        value={value}
        placeholder='Paste or type a link'
        aria-label='Link address'
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            onDone();
            editor.commands.focus();
          }
        }}
        className='h-9 w-56 max-w-full bg-transparent px-2 text-sm outline-none placeholder:opacity-60'
      />
      {editor.isActive('link') ? (
        <button
          type='button'
          aria-label='Remove link'
          onClick={() => {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            onDone();
          }}
          className={toolButton(false)}
        >
          <Trash2Icon className='size-4' />
        </button>
      ) : null}
      <button type='button' aria-label='Close' onClick={onDone} className={toolButton(false)}>
        <XIcon className='size-4' />
      </button>
    </form>
  );
}

const INSERT_ITEMS = [
  { key: 'image', label: 'Image', icon: ImageIcon },
  { key: 'code', label: 'Code block', icon: Code2Icon },
  { key: 'divider', label: 'Divider', icon: MinusIcon },
  { key: 'embed', label: 'Embed', icon: TvIcon }
] as const;

export function StoryEditor({
  initial,
  upload,
  onChange,
  onEditorReady,
  autoFocusTitle = true,
  children
}: {
  initial: EditorSnapshot;
  /** Turns a chosen file into something a figure can show. */
  upload: (file: File) => Promise<UploadedImage>;
  onChange: (snapshot: EditorSnapshot) => void;
  onEditorReady?: (api: { snapshot: () => EditorSnapshot; hasPendingUploads: () => boolean }) => void;
  autoFocusTitle?: boolean;
  children?: ReactNode;
}) {
  const [title, setTitle] = useState(initial.title);
  const [subtitle, setSubtitle] = useState(initial.subtitle);
  const titleRef = useRef<HTMLTextAreaElement | null>(null);
  const subtitleRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const pendingUploads = useRef(0);
  const uploadRef = useRef(upload);
  uploadRef.current = upload;
  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  const [plusOpen, setPlusOpen] = useState(false);
  const [bubbleLink, setBubbleLink] = useState(false);
  const [phoneLink, setPhoneLink] = useState(false);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [embedUrl, setEmbedUrl] = useState('');
  const [touch, setTouch] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const textRef = useRef({ title: initial.title, subtitle: initial.subtitle });

  useEffect(() => {
    const query = window.matchMedia('(pointer: coarse), (max-width: 767px)');
    const update = () => setTouch(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  // Keeps the phone toolbar sitting on top of the on-screen keyboard.
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () =>
      setKeyboardInset(Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop));
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    };
  }, []);

  const insertFiles = useRef<(files: File[], position?: number) => void>(() => {});

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        underline: false,
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: 'https',
          HTMLAttributes: { rel: 'nofollow ugc noopener noreferrer', target: null }
        }
      }),
      // Curly quotes, em dashes, and ellipses as you type. Nothing else gets rewritten.
      Typography.configure({
        leftArrow: false,
        rightArrow: false,
        copyright: false,
        trademark: false,
        servicemark: false,
        registeredTrademark: false,
        oneHalf: false,
        plusMinus: false,
        notEqual: false,
        laquo: false,
        raquo: false,
        multiplication: false,
        superscriptTwo: false,
        superscriptThree: false,
        oneQuarter: false,
        threeQuarters: false
      }),
      Placeholder.configure({
        placeholder: ({ editor: current }) =>
          current.isEmpty ? 'Tell your story…' : '',
        showOnlyCurrent: true
      }),
      Figure,
      Embed
    ],
    content: initial.doc,
    editorProps: {
      attributes: { 'aria-label': 'Story body', class: 'story-body' },
      // Pasted or dropped image files upload instead of landing as raw data.
      handlePaste: (_view, event) => {
        const files = [...(event.clipboardData?.files ?? [])].filter((file) =>
          file.type.startsWith('image/')
        );
        if (!files.length) return false;
        insertFiles.current(files);
        return true;
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false;
        const files = [...(event.dataTransfer?.files ?? [])].filter((file) =>
          file.type.startsWith('image/')
        );
        if (!files.length) return false;
        event.preventDefault();
        const position = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        insertFiles.current(files, position);
        return true;
      }
    },
    onUpdate: ({ editor: current }) => {
      if (pendingUploads.current > 0) return;
      changeRef.current({ ...textRef.current, doc: current.getJSON() as StoryDoc });
    }
  });

  const snapshot = useCallback(
    (): EditorSnapshot => ({
      ...textRef.current,
      doc: (editor?.getJSON() ?? initial.doc) as StoryDoc
    }),
    [editor, initial.doc]
  );

  useEffect(() => {
    if (!editor) return;
    onEditorReady?.({
      snapshot,
      hasPendingUploads: () => pendingUploads.current > 0
    });
    if (autoFocusTitle && !initial.title) titleRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  insertFiles.current = (files, position) => {
    if (!editor) return;
    for (const file of files) {
      const id = crypto.randomUUID();
      const preview = URL.createObjectURL(file);
      pendingUploads.current += 1;
      const at = position ?? editor.state.selection.$from.after(1);
      editor
        .chain()
        .insertContentAt(Math.min(at, editor.state.doc.content.size), [
          { type: 'figure', attrs: { src: preview, uploading: id } },
          { type: 'paragraph' }
        ])
        .run();
      const finish = (attrs: UploadedImage | null) => {
        pendingUploads.current -= 1;
        const { state, view } = editor;
        state.doc.descendants((node, pos) => {
          if (node.type.name !== 'figure' || node.attrs.uploading !== id) return;
          const tr = attrs
            ? state.tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                ...attrs,
                uploading: false
              })
            : state.tr.delete(pos, pos + node.nodeSize);
          view.dispatch(tr);
          return false;
        });
        URL.revokeObjectURL(preview);
      };
      uploadRef
        .current(file)
        .then((result) => finish(result))
        .catch((error) => {
          finish(null);
          toast.error(error instanceof Error ? error.message : 'That image didn’t upload.');
        });
    }
  };

  const insert = (key: (typeof INSERT_ITEMS)[number]['key']) => {
    if (!editor) return;
    setPlusOpen(false);
    if (key === 'image') fileRef.current?.click();
    else if (key === 'code') editor.chain().focus().setCodeBlock().run();
    else if (key === 'divider') editor.chain().focus().setHorizontalRule().run();
    else {
      setEmbedUrl('');
      setEmbedOpen(true);
    }
  };

  const parsedEmbed = parseEmbedUrl(embedUrl);
  const addEmbed = () => {
    if (!editor || !parsedEmbed) return;
    editor
      .chain()
      .focus()
      .insertContent([
        { type: 'embed', attrs: { url: parsedEmbed.url, title: `${parsedEmbed.label} embed` } },
        { type: 'paragraph' }
      ])
      .run();
    setEmbedOpen(false);
  };

  const updateText = (next: { title?: string; subtitle?: string }) => {
    textRef.current = { ...textRef.current, ...next };
    if (next.title !== undefined) setTitle(next.title);
    if (next.subtitle !== undefined) setSubtitle(next.subtitle);
    if (pendingUploads.current === 0) {
      changeRef.current({ ...textRef.current, doc: (editor?.getJSON() ?? initial.doc) as StoryDoc });
    }
  };

  return (
    <div className='story-editor mx-auto max-w-[42rem] px-5 pt-8 pb-40 sm:pt-14' style={{ ['--story-gutter' as string]: '1.25rem' }}>
      {children}
      <AutoTextarea
        textareaRef={titleRef}
        value={title}
        maxLength={limits.titleMax}
        placeholder='Title'
        aria-label='Title'
        onChange={(event) => updateText({ title: event.target.value.replace(/\n/g, ' ') })}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            subtitleRef.current?.focus();
          }
        }}
        className='font-display text-[2.15rem] leading-[1.1] font-medium tracking-[-0.018em] sm:text-[3.05rem] sm:leading-[1.07]'
      />
      <AutoTextarea
        textareaRef={subtitleRef}
        value={subtitle}
        maxLength={limits.subtitleMax}
        placeholder='Add a subtitle'
        aria-label='Subtitle'
        onChange={(event) => updateText({ subtitle: event.target.value.replace(/\n/g, ' ') })}
        onKeyDown={(event) => {
          const target = event.currentTarget;
          if (event.key === 'Enter') {
            event.preventDefault();
            editor?.commands.focus('start');
          } else if (event.key === 'Backspace' && !target.value) {
            event.preventDefault();
            titleRef.current?.focus();
          }
        }}
        className='mt-2 mb-7 font-serif text-[1.3rem] leading-[1.32] text-muted-foreground sm:text-[1.5rem]'
      />

      {editor && !touch ? (
        <BubbleMenu
          editor={editor}
          options={{ placement: 'top', offset: 8 }}
          shouldShow={({ editor: current, state }) => {
            if (!current.isEditable || state.selection.empty) return false;
            return !current.isActive('codeBlock') && !current.isActive('figure') && !current.isActive('embed') && !current.isActive('horizontalRule');
          }}
          className='z-30'
        >
          <div
            role='toolbar'
            aria-label='Format text'
            className='flex items-center rounded-lg bg-foreground p-0.5 text-background shadow-lg'
          >
            {bubbleLink ? (
              <LinkForm editor={editor} onDone={() => setBubbleLink(false)} />
            ) : (
              <FormatButtons editor={editor} onLink={() => setBubbleLink(true)} />
            )}
          </div>
        </BubbleMenu>
      ) : null}

      {editor && !touch ? (
        <FloatingMenu
          editor={editor}
          options={{ placement: 'left-start', offset: 14 }}
          shouldShow={({ editor: current, state }) => {
            const { $from, empty } = state.selection;
            return (
              current.isFocused &&
              empty &&
              $from.depth === 1 &&
              $from.parent.type.name === 'paragraph' &&
              $from.parent.content.size === 0
            );
          }}
          className='z-30'
        >
          <div className='relative'>
            <button
              type='button'
              aria-label={plusOpen ? 'Close insert menu' : 'Insert image, code, divider, or embed'}
              aria-expanded={plusOpen}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setPlusOpen((value) => !value)}
              className={cn(
                'inline-flex size-8 items-center justify-center rounded-full border bg-background text-muted-foreground transition-transform hover:border-foreground hover:text-foreground',
                plusOpen && 'rotate-45'
              )}
            >
              <PlusIcon className='size-4' />
            </button>
            {plusOpen ? (
              <div
                role='menu'
                aria-label='Insert'
                className='absolute top-1/2 left-full ml-3 flex -translate-y-1/2 items-center gap-0.5 rounded-lg border bg-popover p-1 font-sans shadow-md'
              >
                {INSERT_ITEMS.map((item) => (
                  <button
                    key={item.key}
                    type='button'
                    role='menuitem'
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => insert(item.key)}
                    className='inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-[13px] whitespace-nowrap hover:bg-tint'
                  >
                    <item.icon className='size-4' /> {item.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </FloatingMenu>
      ) : null}

      <EditorContent editor={editor} />

      <input
        ref={fileRef}
        type='file'
        accept={limits.imageTypes.join(',')}
        multiple
        className='sr-only'
        aria-label='Choose an image'
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          event.target.value = '';
          if (files.length) insertFiles.current(files);
        }}
      />

      {editor && touch ? (
        <div
          className='fixed inset-x-0 z-30 border-t bg-foreground pb-[env(safe-area-inset-bottom)] text-background'
          style={{ bottom: keyboardInset }}
        >
          {phoneLink ? (
            <LinkForm editor={editor} onDone={() => setPhoneLink(false)} className='px-2 py-1' />
          ) : (
            <div
              role='toolbar'
              aria-label='Format and insert'
              className='scrollbar-none flex items-center overflow-x-auto px-1 py-1'
            >
              <button type='button' aria-label='Add an image' onMouseDown={(event) => event.preventDefault()} onClick={() => insert('image')} className={toolButton(false)}>
                <ImageIcon className='size-[1.15rem]' />
              </button>
              <button type='button' aria-label='Add a code block' onMouseDown={(event) => event.preventDefault()} onClick={() => insert('code')} className={toolButton(false)}>
                <Code2Icon className='size-[1.15rem]' />
              </button>
              <button type='button' aria-label='Add a divider' onMouseDown={(event) => event.preventDefault()} onClick={() => insert('divider')} className={toolButton(false)}>
                <MinusIcon className='size-[1.15rem]' />
              </button>
              <button type='button' aria-label='Add an embed' onMouseDown={(event) => event.preventDefault()} onClick={() => insert('embed')} className={toolButton(false)}>
                <TvIcon className='size-[1.15rem]' />
              </button>
              <span aria-hidden='true' className='mx-1 h-5 w-px shrink-0 bg-current opacity-25' />
              <FormatButtons editor={editor} onLink={() => setPhoneLink(true)} />
            </div>
          )}
        </div>
      ) : null}

      <Dialog open={embedOpen} onOpenChange={setEmbedOpen}>
        <DialogContent className='max-w-md'>
          <DialogHeader>
            <DialogTitle>Add an embed</DialogTitle>
            <DialogDescription>
              Paste a link from YouTube, Vimeo, CodePen, Spotify, or Loom. Readers load it with one click, so your story stays fast.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              addEmbed();
            }}
          >
            <Input
              autoFocus
              value={embedUrl}
              placeholder='https://'
              aria-label='Embed link'
              aria-invalid={embedUrl ? !parsedEmbed : undefined}
              onChange={(event) => setEmbedUrl(event.target.value)}
            />
            {embedUrl && !parsedEmbed ? (
              <p className='mt-2 text-sm text-destructive'>We can’t embed that link. Check it’s from one of the sites above.</p>
            ) : null}
            <DialogFooter className='mt-4'>
              <Button type='button' variant='ghost' className='rounded-full' onClick={() => setEmbedOpen(false)}>Cancel</Button>
              <Button type='submit' className='rounded-full' disabled={!parsedEmbed}>Add embed</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
