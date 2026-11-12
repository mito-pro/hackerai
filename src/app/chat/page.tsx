import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getMaintenance } from "@/lib/settings";
import ChatClient from "./chat-client";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login/");

  const maintenance = await getMaintenance();
  if (maintenance.enabled && user.role !== "admin") {
    redirect("/maintenance/");
  }

  return <ChatClient />;
}
