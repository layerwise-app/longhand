import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import { brand } from '~/brand.config';
import { LogoMark } from '~/components/site/logo';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '~/components/ui/dialog';
import { useViewer } from '~/lib/viewer';

type Gate = (action: string) => boolean;

const GateContext = createContext<Gate>(() => false);

/**
 * `const gate = useAuthGate(); if (!gate('clap for this story')) return;`
 * Reading is open to everyone; actions ask a signed-out reader to join.
 */
export const useAuthGate = () => useContext(GateContext);

export function AuthGateProvider({ children }: { children: ReactNode }) {
  const viewer = useViewer();
  const [action, setAction] = useState<string | null>(null);
  const path = useRouterState({
    select: (state) => state.location.href
  });
  const gate = useCallback<Gate>(
    (next) => {
      if (viewer?.username) return true;
      setAction(next);
      return false;
    },
    [viewer]
  );
  return (
    <GateContext.Provider value={gate}>
      {children}
      <Dialog open={action !== null} onOpenChange={(open) => !open && setAction(null)}>
        <DialogContent className='max-w-sm text-center'>
          <DialogHeader className='items-center text-center'>
            <LogoMark className='size-10 text-primary' />
            <DialogTitle className='font-display text-2xl font-medium'>
              {viewer ? 'Finish your profile' : `Join ${brand.name}`}
            </DialogTitle>
            <DialogDescription>
              {viewer
                ? `Pick a username to ${action}.`
                : `Create a free account to ${action}. It takes less than a minute.`}
            </DialogDescription>
          </DialogHeader>
          <div className='flex flex-col gap-2'>
            {viewer ? (
              <Button asChild className='rounded-full'>
                <Link to='/welcome' search={{ redirect: path }} onClick={() => setAction(null)}>
                  Finish setting up
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild className='rounded-full'>
                  <Link to='/sign-up' search={{ redirect: path }} onClick={() => setAction(null)}>
                    Create an account
                  </Link>
                </Button>
                <Button asChild variant='ghost' className='rounded-full'>
                  <Link to='/sign-in' search={{ redirect: path }} onClick={() => setAction(null)}>
                    I already have one
                  </Link>
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </GateContext.Provider>
  );
}
