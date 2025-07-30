import { genericOAuthClient, inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: "http://localhost:5050",
  plugins: [
    inferAdditionalFields({
      user: {
        surname: { type: 'string' },
        role: { type: 'string', nullable: true },
      },
    }),
    genericOAuthClient(),
  ],
});
