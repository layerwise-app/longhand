import { createMiddleware } from '@tanstack/react-start';
import { loadViewer } from '~/server/viewer';

/** Puts the viewer (or null) on `context`. */
export const withViewer = createMiddleware({ type: 'function' }).server(
  async ({ next }) => next({ context: { viewer: await loadViewer() } })
);

/** Requires a signed-in user. */
export const requireUser = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const viewer = await loadViewer();
    if (!viewer) throw new Error('Please sign in to do that.');
    return next({ context: { viewer } });
  }
);

/** Requires a signed-in user with a finished profile, which public actions need. */
export const requireProfile = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const viewer = await loadViewer();
    if (!viewer) throw new Error('Please sign in to do that.');
    if (!viewer.username) throw new Error('Finish setting up your profile first.');
    return next({
      context: { viewer: { ...viewer, username: viewer.username } }
    });
  }
);

export const requireAdmin = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const viewer = await loadViewer();
    if (viewer?.role !== 'admin') throw new Error('Not allowed.');
    return next({ context: { viewer } });
  }
);
