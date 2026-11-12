import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

const plans = await sql.query(
  "SELECT id, name, providers, capabilities FROM plans ORDER BY priority"
);
console.log("== planos ==");
for (const plan of plans) {
  console.log(`${plan.id} | ${plan.name} | providers=${plan.providers}`);
}

const settings = await sql.query(
  "SELECT key FROM settings WHERE key LIKE 'provider:%' OR key LIKE 'migration:%' ORDER BY key"
);
console.log("\n== settings (chaves/migracoes) ==");
for (const row of settings) console.log(row.key);
