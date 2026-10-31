import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

// Serves uploaded images from one stable address on this site, which is what
// stories store. Keys hold a random id and the file never changes, so it can be
// cached for a long time. Only images come out of here, never markup.
export const Route = createFileRoute('/media/$')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const key = params._splat ?? '';
        if (!/^(uploads|avatars)\/[\w-]+\/[0-9a-f-]{36}\.(jpg|png|webp|gif)$/.test(key)) {
          return new Response('Not found', { status: 404 });
        }
        const object = await env.STORAGE.get(key);
        if (!object || !IMAGE_TYPES.has(object.contentType)) {
          return new Response('Not found', { status: 404 });
        }
        return new Response(object.body, {
          headers: {
            'content-type': object.contentType,
            'content-length': String(object.size),
            'cache-control': 'public, max-age=31536000, immutable',
            'x-content-type-options': 'nosniff',
            'content-security-policy': "default-src 'none'; sandbox"
          }
        });
      }
    }
  }
});
