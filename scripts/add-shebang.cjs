const fs = require("fs");
const p = "dist/cli.js";
let s = fs.readFileSync(p, "utf8");
if (!s.startsWith("#!")) {
  fs.writeFileSync(p, "#!/usr/bin/env node\n" + s);
}
