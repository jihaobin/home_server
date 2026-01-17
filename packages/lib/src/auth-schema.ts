import type { BetterAuthClientPlugin, BetterAuthPlugin } from "better-auth";

const roleFieldSchema = {
    id: "home-server-role-schema",
    schema: {
        user: {
            fields: {
                role: {
                    type: "string[]",
                    required: true,
                    input: true,
                    returned: true,
                    defaultValue: ["customer"],
                },
            },
        },
    },
} satisfies BetterAuthPlugin;

export const roleFieldClientPlugin = {
    id: "home-server-role-plugin",
    $InferServerPlugin: roleFieldSchema,
} satisfies BetterAuthClientPlugin;
