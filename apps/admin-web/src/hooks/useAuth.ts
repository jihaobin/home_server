import "better-auth"
import { authClient } from "@/lib/authClient";

export const { signIn, signUp, signOut, useSession, sendVerificationEmail } = authClient;

// 导出完整的认证客户端以便在组件中使用
export function useAuth() {
  return {
    signIn: {
      email: signIn.email,
      social: signIn.social,
      oauth2: authClient.signIn.oauth2,
    },
    signUp: {
      email: signUp.email,
    },
    signOut,
    useSession,
  };
}
