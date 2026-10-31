import { describe, expect, it } from 'vitest';
import {
  docImages,
  docPlainText,
  isAllowedImageSrc,
  parseEmbedUrl,
  readingMinutes,
  renderDocHtml,
  sanitizeDoc,
  slugify
} from '~/lib/story-doc';

const owner = 'user_1';
const upload = `/media/uploads/${owner}/11111111-2222-3333-4444-555555555555.jpg`;
const clean = (input: unknown) => sanitizeDoc(input, { ownerId: owner });
const html = (input: unknown) => renderDocHtml(clean(input));

const para = (...content: unknown[]) => ({ type: 'paragraph', content });

describe('sanitizeDoc', () => {
  it('drops unknown nodes and marks', () => {
    const doc = clean({
      type: 'doc',
      content: [
        { type: 'script', content: [{ type: 'text', text: 'alert(1)' }] },
        para({ type: 'text', text: 'hi', marks: [{ type: 'onclick' }, { type: 'bold' }] })
      ]
    });
    expect(doc.content).toEqual([
      { type: 'paragraph', content: [{ type: 'text', text: 'hi', marks: [{ type: 'bold' }] }] }
    ]);
  });

  it('never lets markup through text', () => {
    const output = html({
      content: [para({ type: 'text', text: '<img src=x onerror=alert(1)>' })]
    });
    expect(output).not.toContain('<img');
    expect(output).toContain('&lt;img');
  });

  it('removes javascript and data links but keeps safe ones', () => {
    const link = (href: string) =>
      para({ type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href } }] });
    const output = html({
      content: [
        link('javascript:alert(1)'),
        link(' JaVaScRiPt:alert(1)'),
        link('data:text/html,hi'),
        link('//evil.example'),
        link('https://example.com/a?b=1&c="2"')
      ]
    });
    expect(output).not.toMatch(/javascript|data:|evil/i);
    expect(output).toContain('href="https://example.com/a?b=1&amp;c=&quot;2&quot;"');
    expect(output).toContain('rel="nofollow ugc noopener noreferrer"');
  });

  it('allows only this user uploads and site art as images', () => {
    expect(isAllowedImageSrc(upload, owner)).toBe(true);
    expect(isAllowedImageSrc('/art/figures/crumb.webp', owner)).toBe(true);
    expect(isAllowedImageSrc(upload, 'someone_else')).toBe(false);
    expect(isAllowedImageSrc('https://example.com/a.jpg', owner)).toBe(false);
    expect(isAllowedImageSrc('data:image/png;base64,AAAA', owner)).toBe(false);
    expect(isAllowedImageSrc('/art/../secrets.jpg', owner)).toBe(false);
    expect(isAllowedImageSrc(`/media/uploads/${owner}/x.svg`, owner)).toBe(false);
  });

  it('drops figures with foreign images and keeps alt text escaped', () => {
    const doc = clean({
      content: [
        { type: 'figure', attrs: { src: 'https://hotlink.example/a.jpg', alt: 'no' } },
        { type: 'figure', attrs: { src: upload, alt: '"><script>' }, content: [{ type: 'text', text: 'Caption' }] }
      ]
    });
    expect(doc.content).toHaveLength(1);
    const output = renderDocHtml(doc);
    expect(output).not.toContain('<script');
    expect(output).toContain('<figcaption>Caption</figcaption>');
  });

  it('keeps the document structure a story needs', () => {
    const output = html({
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Big' }] },
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Small' }] },
        { type: 'blockquote', content: [para({ type: 'text', text: 'Quote' })] },
        { type: 'bulletList', content: [{ type: 'listItem', content: [para({ type: 'text', text: 'One' })] }] },
        { type: 'orderedList', attrs: { start: 3 }, content: [{ type: 'listItem', content: [para({ type: 'text', text: 'Two' })] }] },
        { type: 'codeBlock', attrs: { language: 'sql' }, content: [{ type: 'text', text: 'select 1 < 2' }] },
        { type: 'horizontalRule' }
      ]
    });
    expect(output).toContain('<h2 id="big">');
    expect(output).toContain('<h3 id="small">');
    expect(output).toContain('<blockquote><p>Quote</p></blockquote>');
    expect(output).toContain('<ul><li><p>One</p></li></ul>');
    expect(output).toContain('<ol start="3">');
    expect(output).toContain('<pre data-language="sql"><code>select 1 &lt; 2</code></pre>');
    expect(output).toContain('<hr>');
  });

  it('ignores code languages that could break out of the attribute', () => {
    const output = html({
      content: [{ type: 'codeBlock', attrs: { language: '"><img>' }, content: [{ type: 'text', text: 'a' }] }]
    });
    expect(output).toBe('<pre><code>a</code></pre>');
  });

  it('survives garbage input', () => {
    for (const input of [null, 1, 'x', {}, { content: 'x' }, { content: [null, 1, { type: 'figure' }] }]) {
      expect(clean(input).content.length).toBeGreaterThan(0);
    }
  });

  it('caps nesting depth', () => {
    let node: unknown = para({ type: 'text', text: 'deep' });
    for (let i = 0; i < 200; i++) node = { type: 'blockquote', content: [node] };
    expect(() => clean({ content: [node] })).not.toThrow();
  });
});

describe('parseEmbedUrl', () => {
  it('turns supported links into players', () => {
    expect(parseEmbedUrl('https://www.youtube.com/watch?v=abc123def45')?.src).toBe(
      'https://www.youtube-nocookie.com/embed/abc123def45'
    );
    expect(parseEmbedUrl('https://youtu.be/abc123def45')?.provider).toBe('youtube');
    expect(parseEmbedUrl('https://vimeo.com/123456789')?.src).toBe(
      'https://player.vimeo.com/video/123456789'
    );
    expect(parseEmbedUrl('https://codepen.io/ana/pen/xyzAB')?.src).toContain('/ana/embed/xyzAB');
    expect(parseEmbedUrl('/embeds/measure.html')?.selfHosted).toBe(true);
  });

  it('refuses everything else', () => {
    for (const url of [
      'http://youtube.com/watch?v=abc123def45',
      'https://evil.example/embed',
      'javascript:alert(1)',
      '/embeds/../secrets.html',
      'https://youtube.com.evil.example/watch?v=abc123def45',
      'https://www.youtube.com/watch?v="><script>',
      null
    ]) {
      expect(parseEmbedUrl(url)).toBeNull();
    }
  });

  it('renders third-party embeds as a link until the reader asks', () => {
    const output = html({ content: [{ type: 'embed', attrs: { url: 'https://youtu.be/abc123def45' } }] });
    expect(output).not.toContain('<iframe');
    expect(output).toContain('data-embed-src="https://www.youtube-nocookie.com/embed/abc123def45"');
  });

  it('sandboxes self-hosted embeds', () => {
    const output = html({ content: [{ type: 'embed', attrs: { url: '/embeds/measure.html', title: 'T' } }] });
    expect(output).toContain('sandbox="allow-scripts"');
    expect(output).not.toContain('allow-same-origin');
  });
});

describe('text helpers', () => {
  const doc = clean({
    content: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'A heading' }] },
      para({ type: 'text', text: 'One  two' }, { type: 'hardBreak' }, { type: 'text', text: ' three' }),
      { type: 'figure', attrs: { src: upload } }
    ]
  });

  it('builds plain text one block per line', () => {
    expect(docPlainText(doc)).toBe('A heading\nOne two three');
  });

  it('estimates reading time with a one minute floor', () => {
    expect(readingMinutes(doc)).toBe(1);
    const long = clean({ content: [para({ type: 'text', text: 'word '.repeat(2300) })] });
    expect(readingMinutes(long)).toBe(10);
  });

  it('lists images for the cover picker', () => {
    expect(docImages(doc)).toEqual([upload]);
  });

  it('makes tidy slugs', () => {
    expect(slugify("Grandma's Crème Brûlée & You!")).toBe('grandmas-creme-brulee-you');
  });
});
