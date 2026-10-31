import type { EditorSnapshot } from '~/components/editor/story-editor';
import { createDraft, uploadImage } from '~/functions/stories.functions';
import { dataUrlToBlob } from '~/lib/image-client';
import type { DocNode, StoryDoc } from '~/lib/story-doc';

export const TRY_DRAFT_KEY = 'longhand:try-draft';
export const tryImportPath = '/dashboard/write/new?import=try';

export function readTryDraft(): EditorSnapshot | null {
  try {
    const raw = window.localStorage.getItem(TRY_DRAFT_KEY);
    return raw ? (JSON.parse(raw) as EditorSnapshot) : null;
  } catch {
    return null;
  }
}

/**
 * Moves a browser-only draft into the signed-in account: images go up to Storage
 * first, then the draft is created, and only then is the browser copy removed.
 */
export async function importTryDraft(): Promise<string | null> {
  const draft = readTryDraft();
  if (!draft) return null;

  const upload = async (node: DocNode): Promise<DocNode | null> => {
    if (node.type === 'figure' && typeof node.attrs?.src === 'string' && node.attrs.src.startsWith('data:')) {
      try {
        const blob = await dataUrlToBlob(node.attrs.src);
        const extension = blob.type.split('/')[1] ?? 'jpg';
        const form = new FormData();
        form.set('file', new File([blob], `image.${extension}`, { type: blob.type }));
        const { url } = await uploadImage({ data: form });
        return { ...node, attrs: { ...node.attrs, src: url } };
      } catch {
        return null;
      }
    }
    if (!node.content) return node;
    const children = await Promise.all(node.content.map(upload));
    return { ...node, content: children.flatMap((child) => child ?? []) };
  };

  const root = await upload(draft.doc as DocNode);
  const created = await createDraft({
    data: {
      title: draft.title,
      subtitle: draft.subtitle,
      doc: root as StoryDoc
    }
  });
  window.localStorage.removeItem(TRY_DRAFT_KEY);
  return created.id;
}
