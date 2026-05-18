import { Auth0Client } from "@auth0/nextjs-auth0/server";

const REQUIRED = ["AUTH0_DOMAIN", "AUTH0_CLIENT_ID", "AUTH0_CLIENT_SECRET", "AUTH0_SECRET"] as const;

export function isAuth0Configured(): boolean {
  return REQUIRED.every((k) => Boolean(process.env[k]));
}

function appBaseUrl(): string {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL;
  return "http://localhost:3000";
}

let _client: Auth0Client | null = null;

export function getAuth0Client(): Auth0Client | null {
  if (!isAuth0Configured()) return null;
  if (_client) return _client;
  _client = new Auth0Client({
    domain: process.env.AUTH0_DOMAIN!,
    clientId: process.env.AUTH0_CLIENT_ID!,
    clientSecret: process.env.AUTH0_CLIENT_SECRET!,
    appBaseUrl: appBaseUrl(),
    secret: process.env.AUTH0_SECRET!,
  });
  return _client;
}
