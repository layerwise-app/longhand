import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';

/** Call after signing in or changing the profile, so the header catches up. */
export function useSessionRefresh() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useCallback(async () => {
    queryClient.removeQueries({ queryKey: ['viewer'] });
    await router.invalidate();
  }, [queryClient, router]);
}
