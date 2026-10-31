import { env } from 'cloudflare:workers';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { admin } from 'better-auth/plugins';
import { emailOTP } from 'better-auth/plugins/email-otp';
import { tanstackStartCookies } from 'better-auth/tanstack-start';
import { db } from '~/db';
import * as schema from '~/db/schema';
import { sendAuthEmail } from '~/lib/auth-email';
import {
  checkRateLimit,
  visitorKey,
  type RateLimitAction
} from '~/server/rate-limit';

const rateLimitedPaths: Record<string, RateLimitAction> = {
  '/sign-up/email': 'signUp',
  '/sign-in/email': 'signIn',
  '/sign-in/email-otp': 'signIn',
  '/email-otp/send-verification-otp': 'sendCode',
  '/forget-password/email-otp': 'sendCode'
};

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL || undefined,
  secret: env.BETTER_AUTH_SECRET || undefined,
  advanced: {
    // Sessions never record the visitor's IP address.
    ipAddress: { disableIpTracking: true },
    defaultCookieAttributes: {
      sameSite: 'none',
      secure: true,
      partitioned: true
    }
  },
  database: drizzleAdapter(db, { provider: 'sqlite', schema }),
  emailAndPassword: {
    enabled: true
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      const action = rateLimitedPaths[ctx.path];
      if (
        action &&
        !(await checkRateLimit(action, await visitorKey(ctx.headers)))
      ) {
        throw new APIError('TOO_MANY_REQUESTS', {
          message: 'Too many attempts. Please wait a few minutes and try again.'
        });
      }
    })
  },
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 300,
      allowedAttempts: 3,
      // New accounts go through /sign-up, which collects a profile.
      disableSignUp: true,
      async sendVerificationOTP({ email, otp, type }) {
        // Seeded authors are fictional and their addresses have no inbox.
        if (email.endsWith('.longhand.example')) return;
        await sendAuthEmail({
          email,
          otp,
          type: type === 'change-email' ? 'email-verification' : type
        });
      }
    }),
    admin(),
    // Must be the last plugin so it can attach Set-Cookie to responses.
    tanstackStartCookies()
  ]
});
