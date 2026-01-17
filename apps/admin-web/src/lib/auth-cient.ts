import { genericOAuthClient, inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

const authBaseURL =
  process.env.NEXT_PUBLIC_AUTH_BASE_URL ??
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, "") ??
  "";

export const authClient = createAuthClient({
  baseURL: authBaseURL,
  plugins: [
    inferAdditionalFields({
      user: {
        surname: { type: 'string' },
        role: { type: 'string[]', nullable: true },
      },
    }),
    genericOAuthClient(),
  ],
});
