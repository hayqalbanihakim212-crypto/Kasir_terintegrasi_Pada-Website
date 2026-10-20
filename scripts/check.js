// Pengecekan cepat: sintaks semua file JS/JSX + skrip web. Pakai: npm run check
// (butuh `npm i` agar @babel/parser tersedia lewat babel-preset-expo; kalau tidak ada, hanya cek skrip web)
const fs = require("fs");
const path = require("path");
let parse;
try {
  parse = require("@babel/parser").parse;
} catch (e) {}

const roots = ["app", "src", "web"];
const files = [];
const walk = (d) => {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (/\.js$/.test(f)) files.push(p);
  }
};
roots.filter((r) => fs.existsSync(r)).forEach(walk);

let bad = 0;
for (const f of files) {
  const code = fs.readFileSync(f, "utf8");
  try {
    if (f.startsWith("web")) new Function(code);
    else if (parse) parse(code, { sourceType: "module", plugins: ["jsx"] });
    else continue;
  } catch (e) {
    bad++;
    console.error("X", f, e.message);
  }
}
console.log(bad ? bad + " file bermasalah" : files.length + " file OK");
process.exit(bad ? 1 : 0);
