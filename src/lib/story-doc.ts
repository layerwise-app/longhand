// The story document: a small ProseMirror-shaped JSON tree. The editor produces
// it, the server sanitizes it against the whitelist below, and the renderer
// turns it into the HTML readers get. Nothing else ever reaches a reader's page,
// so anything not named here (scripts, styles, event handlers, external images)
// cannot survive a save. This file has no dependencies so it can run anywhere.

type Attrs = Record<string, string | number | boolean | null>;

export type Mark = { type: string; attrs?: Attrs };

export type DocNode = {
  type: string;
  attrs?: Attrs;
  content?: DocNode[];
  marks?: Mark[];
  text?: string;
};

export type StoryDoc = { type: 'doc'; content: DocNode[] };

export const emptyDoc = (): StoryDoc => ({
  type: 'doc',
  content: [{ type: 'paragraph' }]
});

const MAX_DEPTH = 8;
const MAX_NODES = 12_000;

const CODE_LANGUAGE = /^[a-z0-9+#-]{1,24}$/i;
const SAFE_LINK = /^(https?:\/\/|mailto:|\/(?!\/))/i;
const UUID = '[0-9a-f-]{36}';

export type SanitizeOptions = {
  /**
   * Images must be the site's own artwork or this user's uploads. Pass null for
   * the seed content, which only uses `/art/`.
   */
  ownerId: string | null;
};

/** True for images a story may show: never another site, never `data:`. */
export function isAllowedImageSrc(src: unknown, ownerId: string | null) {
  if (typeof src !== 'string') return false;
  if (/^\/art\/[a-z0-9/_-]+\.(jpg|webp|png)$/.test(src)) return true;
  if (!ownerId) return false;
  const owner = ownerId.replace(/[^a-zA-Z0-9_-]/g, '');
  return new RegExp(
    `^/media/uploads/${owner}/${UUID}\\.(jpg|png|webp|gif)$`
  ).test(src);
}

function positiveInt(value: unknown) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 && number <= 20_000
    ? number
    : undefined;
}

function shortText(value: unknown, max: number) {
  return typeof value === 'string'
    ? value.replace(/[\u0000-\u001f]/g, ' ').slice(0, max)
    : '';
}

function sanitizeMarks(marks: unknown): Mark[] | undefined {
  if (!Array.isArray(marks)) return undefined;
  const clean: Mark[] = [];
  for (const mark of marks) {
    switch (mark?.type) {
      case 'bold':
      case 'italic':
      case 'code':
      case 'strike':
        clean.push({ type: mark.type });
        break;
      case 'link': {
        const href = mark.attrs?.href;
        if (typeof href === 'string' && SAFE_LINK.test(href.trim())) {
          clean.push({
            type: 'link',
            attrs: { href: href.trim().slice(0, 2000) }
          });
        }
        break;
      }
    }
  }
  return clean.length ? clean : undefined;
}

function sanitizeInline(nodes: unknown, marksAllowed = true): DocNode[] {
  if (!Array.isArray(nodes)) return [];
  const clean: DocNode[] = [];
  for (const node of nodes) {
    if (node?.type === 'text' && typeof node.text === 'string' && node.text) {
      const marks = marksAllowed ? sanitizeMarks(node.marks) : undefined;
      clean.push({
        type: 'text',
        text: node.text.replace(/[\u0000-\u0008\u000b-\u001f]/g, ''),
        ...(marks ? { marks } : {})
      });
    } else if (node?.type === 'hardBreak' && marksAllowed) {
      clean.push({ type: 'hardBreak' });
    }
  }
  return clean;
}

function withContent(type: string, content: DocNode[], attrs?: DocNode['attrs']) {
  return {
    type,
    ...(attrs ? { attrs } : {}),
    ...(content.length ? { content } : {})
  } satisfies DocNode;
}

function sanitizeBlocks(
  nodes: unknown,
  options: SanitizeOptions,
  depth: number,
  counter: { nodes: number }
): DocNode[] {
  if (!Array.isArray(nodes) || depth > MAX_DEPTH) return [];
  const clean: DocNode[] = [];
  for (const node of nodes) {
    if (++counter.nodes > MAX_NODES) break;
    switch (node?.type) {
      case 'paragraph':
        clean.push(withContent('paragraph', sanitizeInline(node.content)));
        break;
      case 'heading': {
        const level = node.attrs?.level === 3 ? 3 : 2;
        clean.push(
          withContent('heading', sanitizeInline(node.content), { level })
        );
        break;
      }
      case 'blockquote': {
        const inner = sanitizeBlocks(node.content, options, depth + 1, counter)
          .filter((child) => child.type === 'paragraph');
        if (inner.length) clean.push({ type: 'blockquote', content: inner });
        break;
      }
      case 'bulletList':
      case 'orderedList': {
        const items: DocNode[] = [];
        for (const item of Array.isArray(node.content) ? node.content : []) {
          if (item?.type !== 'listItem') continue;
          const inner = sanitizeBlocks(item.content, options, depth + 1, counter)
            .filter((child) =>
              ['paragraph', 'bulletList', 'orderedList'].includes(child.type)
            );
          if (inner[0]?.type === 'paragraph') {
            items.push({ type: 'listItem', content: inner });
          }
        }
        if (!items.length) break;
        const start = positiveInt(node.attrs?.start);
        clean.push({
          type: node.type,
          ...(node.type === 'orderedList' && start && start > 1
            ? { attrs: { start } }
            : {}),
          content: items
        });
        break;
      }
      case 'codeBlock': {
        const language = node.attrs?.language;
        const text = (Array.isArray(node.content) ? node.content : [])
          .map((child: DocNode) =>
            child?.type === 'text' && typeof child.text === 'string'
              ? child.text
              : ''
          )
          .join('');
        clean.push(
          withContent(
            'codeBlock',
            text ? [{ type: 'text', text }] : [],
            typeof language === 'string' && CODE_LANGUAGE.test(language)
              ? { language: language.toLowerCase() }
              : undefined
          )
        );
        break;
      }
      case 'horizontalRule':
        clean.push({ type: 'horizontalRule' });
        break;
      case 'figure': {
        if (!isAllowedImageSrc(node.attrs?.src, options.ownerId)) break;
        const width = positiveInt(node.attrs?.width);
        const height = positiveInt(node.attrs?.height);
        clean.push(
          withContent('figure', sanitizeInline(node.content), {
            src: node.attrs.src,
            alt: shortText(node.attrs?.alt, 300),
            ...(width && height ? { width, height } : {})
          })
        );
        break;
      }
      case 'embed': {
        const embed = parseEmbedUrl(node.attrs?.url);
        if (!embed) break;
        clean.push({
          type: 'embed',
          attrs: {
            url: embed.url,
            title: shortText(node.attrs?.title, 120) || embed.label
          }
        });
        break;
      }
    }
  }
  return clean;
}

/** Whitelists a document from any source. Unknown nodes and marks are dropped. */
export function sanitizeDoc(input: unknown, options: SanitizeOptions): StoryDoc {
  const content = sanitizeBlocks(
    (input as DocNode | null)?.content,
    options,
    0,
    { nodes: 0 }
  );
  return { type: 'doc', content: content.length ? content : emptyDoc().content };
}

export type ParsedEmbed = {
  /** The URL the writer gave, normalized. */
  url: string;
  /** What the iframe loads. */
  src: string;
  provider: string;
  label: string;
  /** Hosted here, so it can load straight away. */
  selfHosted: boolean;
};

/** Embeds are limited to these providers and the site's own `/embeds/` pages. */
export function parseEmbedUrl(value: unknown): ParsedEmbed | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (/^\/embeds\/[a-z0-9-]+\.html$/.test(raw)) {
    return {
      url: raw,
      src: raw,
      provider: 'self',
      label: 'Interactive',
      selfHosted: true
    };
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '');
  const parts = url.pathname.split('/').filter(Boolean);
  const external = (provider: string, label: string, src: string) => ({
    url: url.toString(),
    src,
    provider,
    label,
    selfHosted: false
  });

  if (host === 'youtube.com' || host === 'youtu.be') {
    const id =
      host === 'youtu.be'
        ? parts[0]
        : parts[0] === 'watch'
          ? url.searchParams.get('v')
          : ['shorts', 'embed', 'live'].includes(parts[0] ?? '')
            ? parts[1]
            : null;
    if (!id || !/^[\w-]{6,20}$/.test(id)) return null;
    return external(
      'youtube',
      'YouTube',
      `https://www.youtube-nocookie.com/embed/${id}`
    );
  }
  if (host === 'vimeo.com') {
    const id = parts.find((part) => /^\d{4,12}$/.test(part));
    return id
      ? external('vimeo', 'Vimeo', `https://player.vimeo.com/video/${id}`)
      : null;
  }
  if (host === 'codepen.io' && parts[1] === 'pen' && parts[2]) {
    const [user, , id] = parts;
    if (!/^[\w-]+$/.test(user!) || !/^[\w-]+$/.test(id!)) return null;
    return external(
      'codepen',
      'CodePen',
      `https://codepen.io/${user}/embed/${id}?default-tab=result`
    );
  }
  if (host === 'open.spotify.com') {
    const [kind, id] = parts;
    if (
      !['track', 'episode', 'album', 'playlist', 'show'].includes(kind ?? '') ||
      !/^[A-Za-z0-9]{10,40}$/.test(id ?? '')
    )
      return null;
    return external(
      'spotify',
      'Spotify',
      `https://open.spotify.com/embed/${kind}/${id}`
    );
  }
  if (host === 'loom.com' && parts[0] === 'share' && /^\w{10,64}$/.test(parts[1] ?? '')) {
    return external('loom', 'Loom', `https://www.loom.com/embed/${parts[1]}`);
  }
  return null;
}

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ]!
  );

function renderInline(nodes: DocNode[] | undefined): string {
  return (nodes ?? [])
    .map((node) => {
      if (node.type === 'hardBreak') return '<br>';
      let html = escapeHtml(node.text ?? '');
      for (const mark of node.marks ?? []) {
        if (mark.type === 'bold') html = `<strong>${html}</strong>`;
        else if (mark.type === 'italic') html = `<em>${html}</em>`;
        else if (mark.type === 'strike') html = `<s>${html}</s>`;
        else if (mark.type === 'code') html = `<code>${html}</code>`;
        else if (mark.type === 'link') {
          const href = String(mark.attrs?.href ?? '');
          const external = !href.startsWith('/');
          html = `<a href="${escapeHtml(href)}"${
            external ? ' target="_blank" rel="nofollow ugc noopener noreferrer"' : ''
          }>${html}</a>`;
        }
      }
      return html;
    })
    .join('');
}

const textOf = (node: DocNode): string =>
  node.text ?? (node.content ?? []).map(textOf).join('');

export function slugify(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');
}

/** Sanitized document to reader HTML. Every value is escaped on the way out. */
export function renderDocHtml(doc: StoryDoc): string {
  const ids = new Map<string, number>();
  const headingId = (text: string) => {
    const base = slugify(text) || 'section';
    const seen = ids.get(base) ?? 0;
    ids.set(base, seen + 1);
    return seen ? `${base}-${seen + 1}` : base;
  };

  const renderBlock = (node: DocNode): string => {
    switch (node.type) {
      case 'paragraph':
        return `<p>${renderInline(node.content)}</p>`;
      case 'heading': {
        const tag = node.attrs?.level === 3 ? 'h3' : 'h2';
        return `<${tag} id="${headingId(textOf(node))}">${renderInline(node.content)}</${tag}>`;
      }
      case 'blockquote':
        return `<blockquote>${(node.content ?? []).map(renderBlock).join('')}</blockquote>`;
      case 'bulletList':
        return `<ul>${(node.content ?? []).map(renderBlock).join('')}</ul>`;
      case 'orderedList': {
        const start = node.attrs?.start;
        return `<ol${start ? ` start="${Number(start)}"` : ''}>${(node.content ?? []).map(renderBlock).join('')}</ol>`;
      }
      case 'listItem':
        return `<li>${(node.content ?? []).map(renderBlock).join('')}</li>`;
      case 'codeBlock': {
        const language =
          typeof node.attrs?.language === 'string' ? node.attrs.language : '';
        return `<pre${language ? ` data-language="${escapeHtml(language)}"` : ''}><code>${escapeHtml(textOf(node))}</code></pre>`;
      }
      case 'horizontalRule':
        return '<hr>';
      case 'figure': {
        const width = node.attrs?.width;
        const height = node.attrs?.height;
        const size =
          width && height ? ` width="${Number(width)}" height="${Number(height)}"` : '';
        const caption = renderInline(node.content);
        return `<figure><img src="${escapeHtml(String(node.attrs?.src))}" alt="${escapeHtml(String(node.attrs?.alt ?? ''))}"${size} loading="lazy" decoding="async">${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>`;
      }
      case 'embed': {
        const embed = parseEmbedUrl(node.attrs?.url);
        if (!embed) return '';
        const title = escapeHtml(String(node.attrs?.title ?? embed.label));
        if (embed.selfHosted) {
          return `<figure class="story-embed" data-self-hosted><iframe src="${escapeHtml(embed.src)}" title="${title}" loading="lazy" sandbox="allow-scripts"></iframe><figcaption>${title}</figcaption></figure>`;
        }
        // Third-party players load only when the reader asks, which keeps the
        // page fast and keeps their trackers off it until then.
        return `<figure class="story-embed" data-embed-src="${escapeHtml(embed.src)}" data-embed-title="${title}" data-provider="${embed.provider}"><a href="${escapeHtml(embed.url)}" target="_blank" rel="nofollow ugc noopener noreferrer"><span class="story-embed-play" aria-hidden="true"></span><span class="story-embed-label">Load ${escapeHtml(embed.label)} embed</span><span class="story-embed-title">${title}</span></a></figure>`;
      }
      default:
        return '';
    }
  };

  return doc.content.map(renderBlock).join('');
}

const collapseSpace = (value: string) => value.replace(/\s+/g, ' ').trim();

/** Plain text, one block per line. Search and highlights both use it. */
export function docPlainText(doc: StoryDoc): string {
  const lines: string[] = [];
  const walk = (nodes: DocNode[] | undefined) => {
    for (const node of nodes ?? []) {
      if (['bulletList', 'orderedList', 'listItem', 'blockquote'].includes(node.type)) {
        walk(node.content);
      } else if (node.type === 'codeBlock') {
        lines.push(collapseSpace(textOf(node)));
      } else if (node.type === 'figure' || node.type === 'paragraph' || node.type === 'heading') {
        const line = collapseSpace(textOf(node));
        if (line) lines.push(line);
      }
    }
  };
  walk(doc.content);
  return lines.join('\n');
}

export function countWords(text: string) {
  const words = text.trim().match(/\S+/g);
  return words ? words.length : 0;
}

const WORDS_PER_MINUTE = 230;
const SECONDS_PER_IMAGE = 10;

export function readingMinutes(doc: StoryDoc) {
  const words = countWords(docPlainText(doc));
  let images = 0;
  const walk = (nodes: DocNode[] | undefined) => {
    for (const node of nodes ?? []) {
      if (node.type === 'figure') images += 1;
      walk(node.content);
    }
  };
  walk(doc.content);
  return Math.max(
    1,
    Math.round(words / WORDS_PER_MINUTE + (images * SECONDS_PER_IMAGE) / 60)
  );
}

/** Image sources in the order they appear; the publish dialog offers them as covers. */
export function docImages(doc: StoryDoc): string[] {
  const found: string[] = [];
  const walk = (nodes: DocNode[] | undefined) => {
    for (const node of nodes ?? []) {
      if (node.type === 'figure' && typeof node.attrs?.src === 'string') {
        found.push(node.attrs.src);
      }
      walk(node.content);
    }
  };
  walk(doc.content);
  return found;
}

/** A sentence or two from the opening, for stories without a written description. */
export function excerptFrom(text: string, max = 180) {
  const flat = collapseSpace(text);
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const sentence = cut.lastIndexOf('. ');
  if (sentence > max * 0.5) return cut.slice(0, sentence + 1);
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}

export const hasUsableBody = (doc: StoryDoc) =>
  countWords(docPlainText(doc)) >= 1 || docImages(doc).length > 0;
