import { getAppUser } from "../../../lib/app-user";

export async function GET() {
  try {
    const user = await getAppUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    return Response.json({ user: { displayName: user.displayName, email: user.email, role: user.role } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}
