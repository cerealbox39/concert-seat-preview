import { copyFile, mkdir, writeFile } from "node:fs/promises";

// A generated, self-contained file for viewers that cannot run a Vite server.
await copyFile(
  new URL("../dist/index.html", import.meta.url),
  new URL("../preview.html", import.meta.url),
);
console.log("Standalone preview written to preview.html");

// Include a ready-built copy in repository downloads and GitHub Pages' /docs source.
await mkdir(new URL("../docs/", import.meta.url), { recursive: true });
await copyFile(
  new URL("../dist/index.html", import.meta.url),
  new URL("../docs/index.html", import.meta.url),
);
await writeFile(new URL("../docs/.nojekyll", import.meta.url), "");
console.log("GitHub download and Pages copy written to docs/index.html");
