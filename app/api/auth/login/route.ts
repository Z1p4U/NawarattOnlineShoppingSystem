import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { appUsers } from "../../../../db/schema";
import { createSessionToken, sessionCookie } from "../../../../lib/app-session";
import { verifyPassword } from "../../../../lib/password";

function clean(value: unknown, max = 180) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const email = clean(payload.email).toLocaleLowerCase();
    const password = clean(payload.password, 200);

    if (!email || !password) {
      return Response.json({ error: "Email နှင့် Password ဖြည့်ပါ" }, { status: 400 });
    }

    const [user] = await getDb().select().from(appUsers).where(eq(appUsers.email, email)).limit(1);
    if (!user?.passwordHash) {
      return Response.json({ error: "ဒီ Account အတွက် Password မသတ်မှတ်ရသေးပါ။ Admin ထံ ဆက်သွယ်ပါ" }, { status: 401 });
    }
    if (!(await verifyPassword(password, user.passwordHash))) {
      return Response.json({ error: "Email သို့မဟုတ် Password မမှန်ပါ" }, { status: 401 });
    }

    const token = await createSessionToken(user.email);
    return Response.json(
      { user: { displayName: user.displayName, email: user.email, role: user.role } },
      { headers: { "Set-Cookie": sessionCookie(token), "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Login service error", error);
    return Response.json(
      { error: "Login Server ယာယီချိတ်ဆက်၍မရပါ။ ခဏနေရင် ပြန်စမ်းပါ" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
