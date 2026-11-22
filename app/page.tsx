import DashboardClient from "./dashboard-client";
import LoginClient from "./login-client";
import { getAppUser } from "../lib/app-user";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getAppUser();
  if (!user) return <LoginClient />;
  return <DashboardClient userName={user.displayName} initialRole={user.role} />;
}
