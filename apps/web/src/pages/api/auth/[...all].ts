// Mounts Better Auth's HTTP endpoints at /api/auth/* (sign-in, sign-up,
// session, reset-password links...). Our own pages call auth.api.* directly;
// this route serves the links in emails and any future client-side calls.
import type { APIRoute } from "astro";
import { auth } from "../../../lib/auth.ts";

export const ALL: APIRoute = ({ request }) => auth.handler(request);
