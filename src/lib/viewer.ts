import { useRouteContext } from '@tanstack/react-router';
import type { ViewerWithUnread } from '~/functions/viewer.functions';

export function useViewer(): ViewerWithUnread | null {
  return useRouteContext({
    from: '__root__',
    select: (context) => context.viewer ?? null
  });
}
