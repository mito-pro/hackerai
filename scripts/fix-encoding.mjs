import fs from "node:fs";
import path from "node:path";

const root = "src";
const bad = /\u00e2[\u0080-\u00bf\u0100-\u017f]|\u00c3[\u0080-\u00bf\u0100-\u017f]|\u00c2[\u0080-\u00bf]/;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
      continue;
    }
    if (!/\.(tsx?|css|json|md|mjs)$/.test(entry.name)) continue;
    const source = fs.readFileSync(full, "utf8");
    source.split(/\r?\n/).forEach((line, index) => {
      if (bad.test(line)) {
        console.log(`${full}:${index + 1}: ${line.trim().slice(0, 120)}`);
      }
    });
  }
}

walk(root);
console.log("varredura concluida");
