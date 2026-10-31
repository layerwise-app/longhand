/// <reference types="vite/client" />
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext
} from '@tanstack/react-router';
import type { QueryClient } from '@tanstack/react-query';
import type * as React from 'react';
import { ThemeProvider } from 'next-themes';
import newsreaderUrl from '@fontsource-variable/newsreader/files/newsreader-latin-opsz-normal.woff2?url';
import { brand, brandCss } from '~/brand.config';
import { DefaultCatchBoundary } from '~/components/DefaultCatchBoundary';
import { NotFound } from '~/components/NotFound';
import { AuthGateProvider } from '~/components/site/auth-gate';
import { Toaster } from '~/components/ui/sonner';
import { TooltipProvider } from '~/components/ui/tooltip';
import {
  getViewer,
  type ViewerWithUnread
} from '~/functions/viewer.functions';
import { site } from '~/lib/site';
import { seo } from '~/utils/seo';
import '~/styles/app.css';

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
  viewer: ViewerWithUnread | null;
}>()({
  beforeLoad: async ({ context }) => {
    const viewer = await context.queryClient.ensureQueryData({
      queryKey: ['viewer'],
      queryFn: () => getViewer(),
      staleTime: 60_000
    });
    return { viewer };
  },
  // Site-wide defaults; each page's `seo()` overrides tags with the same name.
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'theme-color', content: brand.colors.light.paper },
      ...(site.googleSiteVerification
        ? [
            {
              name: 'google-site-verification',
              content: site.googleSiteVerification
            }
          ]
        : []),
      ...seo({ title: site.name, description: site.description }).meta
    ],
    links: [
      { rel: 'icon', href: '/favicon.ico', sizes: '32x32' },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      { rel: 'manifest', href: '/site.webmanifest' },
      // The story font, loaded ahead of first paint so text doesn't reflow.
      {
        rel: 'preload',
        href: newsreaderUrl,
        as: 'font',
        type: 'font/woff2',
        crossOrigin: 'anonymous'
      }
    ],
    styles: [{ children: brandCss() }]
  }),
  errorComponent: (props) => (
    <RootDocument>
      <DefaultCatchBoundary {...props} />
    </RootDocument>
  ),
  notFoundComponent: () => <NotFound />,
  component: RootComponent
});

function RootComponent() {
  return (
    <RootDocument>
      <AuthGateProvider>
        <Outlet />
      </AuthGateProvider>
    </RootDocument>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang='en' suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <ThemeProvider
          attribute='class'
          defaultTheme='light'
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider>
            {children}
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  );
}
