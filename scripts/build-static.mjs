import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "dist");
const publicPaths = ["index.html", "assets", "data"];

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

for (const relativePath of publicPaths) {
  const source = path.join(root, relativePath);
  const destination = path.join(dist, relativePath);
  fs.cpSync(source, destination, { recursive: true, dereference: true });
}

const forbidden = [".git", "node_modules", "scripts", "tests", "package.json", "package-lock.json", "README.md"];
for (const relativePath of forbidden) {
  if (fs.existsSync(path.join(dist, relativePath))) {
    throw new Error(`发布目录包含禁止文件：${relativePath}`);
  }
}

console.log(`Static release built: ${dist}`);
