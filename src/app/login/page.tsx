import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getMaintenance } from "@/lib/settings";
import LoginClient from "./login-client";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getSessionUser();
  const maintenance = await getMaintenance();

  if (user && maintenance.enabled && user.role !== "admin") {
    redirect("/maintenance/");
  }

  if (user && !maintenance.enabled) {
    redirect("/chat/");
  }

  return <LoginClient />;
}
