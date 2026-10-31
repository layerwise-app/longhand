import { useRef, useState } from 'react';
import { CameraIcon } from 'lucide-react';
import { toast } from 'sonner';
import { UserAvatar } from '~/components/site/user-avatar';
import { uploadImage } from '~/functions/stories.functions';
import { prepareImage } from '~/lib/image-client';

export function AvatarPicker({
  name,
  value,
  onChange
}: {
  name: string;
  value: string | null;
  onChange: (url: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const pick = async (file: File) => {
    setBusy(true);
    try {
      const prepared = await prepareImage(file, { maxSide: 480, quality: 0.86 });
      const form = new FormData();
      form.set('file', new File([prepared.blob], prepared.name, { type: prepared.blob.type }));
      form.set('kind', 'avatar');
      const { url } = await uploadImage({ data: form });
      onChange(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'That upload didn’t work.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className='flex items-center gap-4'>
      <UserAvatar name={name || '?'} src={value} size={72} />
      <div>
        <button
          type='button'
          disabled={busy}
          onClick={() => input.current?.click()}
          className='inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm hover:border-foreground disabled:opacity-50'
        >
          <CameraIcon className='size-4' />
          {busy ? 'Uploading…' : value ? 'Change picture' : 'Add a picture'}
        </button>
        <p className='mt-1.5 text-xs text-muted-foreground'>JPG, PNG, WebP, or GIF up to 8 MB.</p>
      </div>
      <input
        ref={input}
        type='file'
        accept='image/jpeg,image/png,image/webp,image/gif'
        className='sr-only'
        aria-label='Choose a profile picture'
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void pick(file);
        }}
      />
    </div>
  );
}
