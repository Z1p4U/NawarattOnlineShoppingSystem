import { clearSessionCookie } from "../../../../lib/app-session";

export async function POST() {
  return Response.json(
    { ok: true },
    { headers: { "Set-Cookie": clearSessionCookie() } },
  );
}
