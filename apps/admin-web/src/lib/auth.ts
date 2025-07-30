"use server"

import { ofetch } from "ofetch";
import "server-only"
import { authClient } from "./authClient"
import { unstable_cache } from "next/cache";
import { headers } from "next/headers";
// import { cache } from "react"
// import { headers } from "next/headers"

type ErrorTypes = Partial<
	Record<
		keyof typeof authClient.$ERROR_CODES,
		{
			en: string;
			es: string;
		}
	>
>;

export const requireUser = unstable_cache(async () => {
  const sessions = await authClient.getSession({
    fetchOptions: {
      headers: await headers()
    }
  })

  return {
    id: sessions.data?.user.id,
    name: sessions.data?.user.name,
    email: sessions.data?.user.email,
    image: sessions.data?.user.image,
    role: sessions.data?.user.role,
  }
})

export async function logout() {
  await authClient.signOut();
}

export async function login({ email, password }: {
  email: string; password: string
}) {

  return await authClient.signIn.email({
    email,
    password,
    callbackURL:"http://localhost:3000/"
  })
}

export async function register({ name, email, password, }: {
  name: string, email: string; password: string
}) {

  return await authClient.signUp.email({
    name,
    email,
    password,
    callbackURL: "http://localhost:3000/auth/verify-email",
    surname: name,
    role: "user"
  })
}

export async function socialLogin({ provider}: {
  provider: string;
}) {

  return await authClient.signIn.social({
    provider,
    callbackURL: `http://localhost:3000/`
  })
}

export async function wechatLogin() {
  return await authClient.signIn.oauth2({
    providerId: "wechat",
    callbackURL: `http://localhost:3000/`
  })
}


