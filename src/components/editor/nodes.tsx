import { useState } from 'react';
import {
  Node,
  mergeAttributes,
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps
} from '@tiptap/react';
import { Loader2Icon, Trash2Icon } from 'lucide-react';
import { parseEmbedUrl } from '~/lib/story-doc';

function FigureView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const [editingAlt, setEditingAlt] = useState(false);
  const { src, alt, width, height, uploading } = node.attrs as {
    src: string;
    alt: string;
    width: number | null;
    height: number | null;
    uploading: boolean;
  };
  return (
    <NodeViewWrapper as='figure' data-selected={selected || undefined}>
      <div contentEditable={false} className='group relative'>
        <img
          src={src}
          alt={alt}
          width={width ?? undefined}
          height={height ?? undefined}
          draggable={false}
          className={uploading ? 'opacity-60' : selected ? 'outline-2 outline-offset-2 outline-primary' : ''}
        />
        {uploading ? (
          <span className='absolute inset-0 flex items-center justify-center'>
            <span className='inline-flex items-center gap-2 rounded-full bg-foreground px-3 py-1.5 font-sans text-sm text-background'>
              <Loader2Icon className='size-4 animate-spin' /> Uploading…
            </span>
          </span>
        ) : (
          <div
            className={`absolute top-2 right-2 flex gap-1 font-sans transition-opacity group-hover:opacity-100 ${selected || editingAlt ? 'opacity-100' : 'opacity-0 focus-within:opacity-100'}`}
          >
            <button
              type='button'
              onClick={() => setEditingAlt((value) => !value)}
              className='h-8 rounded-full bg-foreground/85 px-3 text-xs font-medium text-background hover:bg-foreground'
            >
              {alt ? 'Edit alt text' : 'Add alt text'}
            </button>
            <button
              type='button'
              aria-label='Remove image'
              onClick={() => deleteNode()}
              className='inline-flex size-8 items-center justify-center rounded-full bg-foreground/85 text-background hover:bg-foreground'
            >
              <Trash2Icon className='size-3.5' />
            </button>
          </div>
        )}
        {editingAlt ? (
          <div className='absolute inset-x-2 bottom-2 font-sans'>
            <input
              autoFocus
              value={alt}
              maxLength={300}
              aria-label='Describe this image for people who can’t see it'
              placeholder='Describe this image for people who can’t see it'
              onChange={(event) => updateAttributes({ alt: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === 'Escape') {
                  event.preventDefault();
                  setEditingAlt(false);
                }
                event.stopPropagation();
              }}
              onBlur={() => setEditingAlt(false)}
              className='h-9 w-full rounded-md border bg-surface px-3 text-sm text-foreground outline-none'
            />
          </div>
        ) : null}
      </div>
      <NodeViewContent<'figcaption'> as='figcaption' data-empty={node.content.size === 0} />
    </NodeViewWrapper>
  );
}

const ALLOWED_PASTE = /^(\/media\/|\/art\/|data:image\/)/;

/** An image with a caption. The caption is the node's editable content. */
export const Figure = Node.create({
  name: 'figure',
  group: 'block',
  content: 'text*',
  marks: '',
  isolating: true,
  draggable: true,
  addAttributes() {
    return {
      src: { default: null },
      alt: { default: '' },
      width: { default: null },
      height: { default: null },
      // Only ever true in the browser, while an image is on its way up.
      uploading: { default: false, rendered: false }
    };
  },
  parseHTML() {
    return [
      {
        tag: 'figure',
        contentElement: 'figcaption',
        // Images pasted from other sites never come along: no hotlinking.
        getAttrs: (element) => {
          const image = element.querySelector('img');
          const src = image?.getAttribute('src') ?? '';
          if (!ALLOWED_PASTE.test(src)) return false;
          return {
            src,
            alt: image?.getAttribute('alt') ?? '',
            width: Number(image?.getAttribute('width')) || null,
            height: Number(image?.getAttribute('height')) || null
          };
        }
      }
    ];
  },
  renderHTML({ HTMLAttributes, node }) {
    return [
      'figure',
      {},
      ['img', mergeAttributes(HTMLAttributes, { alt: node.attrs.alt })],
      ['figcaption', 0]
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(FigureView);
  },
  addKeyboardShortcuts() {
    return {
      // Enter in a caption moves on to a new paragraph.
      Enter: ({ editor }) => {
        const { $from } = editor.state.selection;
        if ($from.parent.type.name !== 'figure') return false;
        const after = $from.after();
        return editor
          .chain()
          .insertContentAt(after, { type: 'paragraph' })
          .setTextSelection(after + 1)
          .run();
      }
    };
  }
});

function EmbedView({ node, deleteNode, selected }: NodeViewProps) {
  const embed = parseEmbedUrl(node.attrs.url);
  if (!embed) return <NodeViewWrapper as='figure' />;
  return (
    <NodeViewWrapper as='figure' className='story-embed group relative' data-self-hosted={embed.selfHosted || undefined}>
      <div contentEditable={false} className={selected ? 'rounded-lg outline-2 outline-offset-2 outline-primary' : ''}>
        {embed.selfHosted ? (
          <iframe src={embed.src} title={node.attrs.title} sandbox='allow-scripts' loading='lazy' />
        ) : (
          <a href={embed.url} onClick={(event) => event.preventDefault()}>
            <span className='story-embed-play' aria-hidden='true' />
            <span className='story-embed-label'>{embed.label} embed</span>
            <span className='story-embed-title'>Readers load it with one click.</span>
          </a>
        )}
      </div>
      <button
        type='button'
        contentEditable={false}
        aria-label='Remove embed'
        onClick={() => deleteNode()}
        className='absolute top-2 right-2 inline-flex size-8 items-center justify-center rounded-full bg-foreground/85 text-background opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100'
      >
        <Trash2Icon className='size-3.5' />
      </button>
    </NodeViewWrapper>
  );
}

export const Embed = Node.create({
  name: 'embed',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return { url: { default: null }, title: { default: '' } };
  },
  parseHTML() {
    return [{ tag: 'div[data-story-embed]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-story-embed': '' }, HTMLAttributes)];
  },
  addNodeView() {
    return ReactNodeViewRenderer(EmbedView);
  }
});
