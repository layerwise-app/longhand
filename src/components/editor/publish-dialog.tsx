import { useMemo, useRef, useState } from 'react';
import { ImageIcon, Loader2Icon, XIcon } from 'lucide-react';
import { toast } from 'sonner';
import { brand } from '~/brand.config';
import { UserAvatar } from '~/components/site/user-avatar';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Textarea } from '~/components/ui/textarea';
import { publishStory, uploadImage } from '~/functions/stories.functions';
import { prepareImage } from '~/lib/image-client';
import { limits } from '~/lib/limits';
import { coverThumb } from '~/lib/media';
import {
  docImages,
  docPlainText,
  excerptFrom,
  readingMinutes,
  sanitizeDoc
} from '~/lib/story-doc';
import { cn } from '~/lib/utils';
import type { EditorSnapshot } from '~/components/editor/story-editor';
import type { ViewerWithUnread } from '~/functions/viewer.functions';

export type PublishDefaults = {
  description: string;
  coverUrl: string | null;
  coverAlt: string;
  topics: string[];
};

export function PublishDialog({
  open,
  onOpenChange,
  storyId,
  snapshot,
  defaults,
  isUpdate,
  viewer,
  beforePublish,
  onPublished
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storyId: string | null;
  snapshot: EditorSnapshot;
  defaults: PublishDefaults;
  isUpdate: boolean;
  viewer: ViewerWithUnread;
  /** Makes sure the draft exists on the server; returns its id. */
  beforePublish: () => Promise<string>;
  onPublished: (slug: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [description, setDescription] = useState(defaults.description);
  const [coverUrl, setCoverUrl] = useState(defaults.coverUrl);
  const [coverAlt, setCoverAlt] = useState(defaults.coverAlt);
  const [topics, setTopics] = useState<string[]>(defaults.topics);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clean = useMemo(
    () => sanitizeDoc(snapshot.doc, { ownerId: viewer.id }),
    [snapshot.doc, viewer.id]
  );
  const plain = useMemo(() => docPlainText(clean), [clean]);
  const minutes = useMemo(() => readingMinutes(clean), [clean]);
  const suggestion = excerptFrom(snapshot.subtitle || plain, limits.descriptionMax);
  const storyImages = useMemo(() => docImages(clean), [clean]);
  const shownDescription = description || suggestion;
  const title = snapshot.title.trim();

  const pickCover = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      // JPEG, because every link preview can show it.
      const prepared = await prepareImage(file, { maxSide: 1600, quality: 0.84, jpegOnly: true });
      const form = new FormData();
      form.set('file', new File([prepared.blob], 'cover.jpg', { type: prepared.blob.type }));
      const { url } = await uploadImage({ data: form });
      setCoverUrl(url);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'That upload didn’t work.');
    } finally {
      setUploading(false);
    }
  };

  const toggleTopic = (slug: string) => {
    setTopics((current) =>
      current.includes(slug)
        ? current.filter((topic) => topic !== slug)
        : current.length >= limits.topicsMax
          ? current
          : [...current, slug]
    );
  };

  const publish = async () => {
    setBusy(true);
    setError(null);
    try {
      const id = storyId ?? (await beforePublish());
      const { slug } = await publishStory({
        data: {
          id,
          title,
          subtitle: snapshot.subtitle,
          description: shownDescription,
          coverUrl,
          coverAlt,
          topics,
          doc: snapshot.doc
        }
      });
      toast.success(isUpdate ? 'Your changes are live.' : 'Your story is published.');
      onPublished(slug);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'We couldn’t publish that. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[92dvh] max-w-3xl overflow-y-auto sm:max-w-3xl'>
        <DialogHeader>
          <DialogTitle className='font-display text-2xl font-medium'>
            {isUpdate ? 'Update your story' : 'Ready to publish?'}
          </DialogTitle>
          <DialogDescription>Here’s how it will look in people’s feeds.</DialogDescription>
        </DialogHeader>
        <div className='grid gap-7 md:grid-cols-2'>
          <div className='min-w-0 space-y-5'>
            <div>
              <Label className='mb-2 block'>Cover image</Label>
              {coverUrl ? (
                <div className='relative'>
                  <img src={coverThumb(coverUrl)} alt='' className='aspect-[16/9] w-full rounded-md bg-tint object-cover' />
                  <button
                    type='button'
                    aria-label='Remove cover'
                    onClick={() => setCoverUrl(null)}
                    className='absolute top-2 right-2 inline-flex size-8 items-center justify-center rounded-full bg-foreground/85 text-background hover:bg-foreground'
                  >
                    <XIcon className='size-4' />
                  </button>
                </div>
              ) : (
                <button
                  type='button'
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                  className='flex aspect-[16/9] w-full flex-col items-center justify-center gap-1.5 rounded-md border border-dashed bg-tint/50 text-sm text-muted-foreground hover:border-muted-foreground'
                >
                  {uploading ? <Loader2Icon className='size-5 animate-spin' /> : <ImageIcon className='size-5' />}
                  {uploading ? 'Uploading…' : 'Upload a cover'}
                  <span className='text-xs'>JPG, PNG, WebP, or GIF up to 8 MB</span>
                </button>
              )}
              {!coverUrl && storyImages.length ? (
                <div className='mt-2'>
                  <p className='mb-1.5 text-xs text-muted-foreground'>Or use an image from your story</p>
                  <div className='flex flex-wrap gap-2'>
                    {storyImages.slice(0, 6).map((src) => (
                      <button key={src} type='button' aria-label='Use this image as the cover' onClick={() => setCoverUrl(src)} className='overflow-hidden rounded-sm ring-offset-2 hover:ring-2 hover:ring-ring'>
                        <img src={src} alt='' className='h-12 w-16 bg-tint object-cover' />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {coverUrl ? (
                <Input
                  className='mt-2'
                  value={coverAlt}
                  maxLength={300}
                  placeholder='Describe the image for people who can’t see it'
                  aria-label='Cover image description'
                  onChange={(event) => setCoverAlt(event.target.value)}
                />
              ) : null}
              <input
                ref={fileRef}
                type='file'
                accept={limits.imageTypes.join(',')}
                className='sr-only'
                aria-label='Choose a cover image'
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file) void pickCover(file);
                }}
              />
            </div>
            <div>
              <Label htmlFor='publish-description' className='mb-2 block'>Short description</Label>
              <Textarea
                id='publish-description'
                rows={3}
                maxLength={limits.descriptionMax}
                value={description}
                placeholder={suggestion || 'What’s this story about?'}
                onChange={(event) => setDescription(event.target.value)}
              />
              <p className='mt-1 text-right text-xs text-muted-foreground'>
                {description.length}/{limits.descriptionMax}. Also used for search and link previews.
              </p>
            </div>
          </div>
          <div className='min-w-0 space-y-5'>
            <div>
              <p className='mb-2 text-sm font-medium'>Preview</p>
              <div className='rounded-md border bg-surface p-4'>
                <div className='flex items-center gap-2 text-[13px] font-medium'>
                  <UserAvatar name={viewer.name} src={viewer.avatarUrl} size={22} />
                  {viewer.name}
                </div>
                <div className='mt-2 flex items-start gap-3'>
                  <div className='min-w-0 flex-1'>
                    <p className='font-display text-[1.25rem] leading-tight font-medium'>
                      {title || <span className='text-muted-foreground'>Add a title to your story</span>}
                    </p>
                    <p className='mt-1 line-clamp-2 font-serif leading-snug text-muted-foreground'>
                      {snapshot.subtitle || shownDescription}
                    </p>
                    <p className='mt-2 text-[12px] text-muted-foreground'>{minutes} min read</p>
                  </div>
                  {coverUrl ? (
                    <img src={coverThumb(coverUrl)} alt='' className='aspect-square w-16 rounded-sm bg-tint object-cover' />
                  ) : null}
                </div>
              </div>
            </div>
            <fieldset>
              <legend className='mb-2 text-sm font-medium'>
                Topics <span className='font-normal text-muted-foreground'>{topics.length} of {limits.topicsMax}</span>
              </legend>
              <div className='flex flex-wrap gap-1.5'>
                {brand.topics.map((topic) => {
                  const selected = topics.includes(topic.slug);
                  const full = !selected && topics.length >= limits.topicsMax;
                  return (
                    <button
                      key={topic.slug}
                      type='button'
                      aria-pressed={selected}
                      disabled={full}
                      onClick={() => toggleTopic(topic.slug)}
                      className={cn(
                        'rounded-full px-3 py-1.5 text-[13px] transition-colors disabled:opacity-40',
                        selected ? 'bg-primary text-primary-foreground' : 'bg-tint hover:bg-border'
                      )}
                    >
                      {topic.name}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </div>
        </div>
        <div className='sticky -bottom-6 z-10 -mx-6 -mb-6 rounded-b-xl border-t bg-popover px-6 py-3'>
          {error ? <p className='mb-2 text-sm text-destructive' role='alert'>{error}</p> : null}
          <div className='flex items-center justify-end gap-2'>
            <Button variant='ghost' className='rounded-full' onClick={() => onOpenChange(false)}>
              Keep writing
            </Button>
            <Button className='rounded-full' disabled={busy || uploading || !title} onClick={publish}>
              {busy ? 'Publishing…' : isUpdate ? 'Update story' : 'Publish now'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
