import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";

// A generated, self-contained file for viewers that cannot run a Vite server.
await copyFile(
  new URL("../dist/index.html", import.meta.url),
  new URL("../preview.html", import.meta.url),
);
console.log("Standalone preview written to preview.html");

// Include a ready-built copy in repository downloads and GitHub Pages' /docs source.
await mkdir(new URL("../docs/", import.meta.url), { recursive: true });
const builtHtml = await readFile(
  new URL("../dist/index.html", import.meta.url),
  "utf8",
);
const analytics = `  <script data-goatcounter="https://cerealbox.goatcounter.com/count"
    async src="https://gc.zgo.at/count.js"></script>`;
await writeFile(
  new URL("../docs/index.html", import.meta.url),
  builtHtml.replace("</body>", `${analytics}\n</body>`),
);
await writeFile(new URL("../docs/.nojekyll", import.meta.url), "");
console.log("GitHub Pages copy with analytics written to docs/index.html");
