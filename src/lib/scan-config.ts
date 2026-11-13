import { getSetting } from "./settings";

export async function pentestEnabled(): Promise<boolean> {
  return (await getSetting("scan:enabled")) !== "false";
}
