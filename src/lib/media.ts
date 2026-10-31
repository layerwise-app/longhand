/** A smaller version of the site's own cover art, for cards. Uploads have one size. */
export function coverThumb(url: string) {
  return url.startsWith('/art/covers/')
    ? url.replace(/\.jpg$/, '-sm.webp')
    : url;
}

/** `srcset` for a cover, when a smaller version exists. */
export function coverSrcSet(url: string) {
  return url.startsWith('/art/covers/')
    ? `${coverThumb(url)} 640w, ${url} 1600w`
    : undefined;
}
