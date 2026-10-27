export function adminEmailAllowlist(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function hasAdminAllowlist(): boolean {
  return adminEmailAllowlist().length > 0;
}

export function isAdminEmail(email: string): boolean {
  return adminEmailAllowlist().includes(email.trim().toLowerCase());
}

export type AdminContact = {
  email: string;
  telegram: string;
  github: string;
  site: string;
};

export function getAdminContact(): AdminContact {
  return {
    email:
      process.env.ADMIN_CONTACT_EMAIL ||
      adminEmailAllowlist()[0] ||
      "suportecybervault@gmail.com",
    telegram: process.env.ADMIN_CONTACT_TELEGRAM || "",
    github: process.env.ADMIN_CONTACT_GITHUB || "",
    site: process.env.ADMIN_CONTACT_SITE || "",
  };
}
