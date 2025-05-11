// build.js
"use strict";

const fs       = require("fs-extra");
const path     = require("path");
const glob     = require("glob");
const postcss  = require("postcss");
const atImport = require("postcss-import");
const cssnano  = require("cssnano");
const purgecss = require("@fullhuman/postcss-purgecss").default;
const { minify } = require("terser");

// ——————————————————————————————————————————————————————————————————————————————————
// CONFIG
// ——————————————————————————————————————————————————————————————————————————————————
const PATTERNS = {
  html: "index.html",
  css:  "css/**/*.css",
  js:   "js/**/*.js",
  img:  "img/**/*"
};

const DIST    = "dist";
const LIB_DIR = (v) => path.join(DIST, `@v${v}`);
const version = process.argv[2] || fs.readFileSync("VERSION", "utf8").trim();

// names to skip when copying root files
const SKIP = new Set([
  "node_modules",
  DIST,
  "package.json",
  "VERSION",
  "package-lock.json",
  path.basename(__filename)
]);

// ——————————————————————————————————————————————————————————————————————————————————
// CLEAN DIST
// ——————————————————————————————————————————————————————————————————————————————————
async function cleanDist() {
  await fs.remove(DIST);
  await fs.mkdirp(DIST);
}

// ——————————————————————————————————————————————————————————————————————————————————
// COPY ROOT ENTRIES (files/dirs) except SKIP
// ——————————————————————————————————————————————————————————————————————————————————
async function copyRootAssets() {
  const entries = await fs.readdir(process.cwd());
  for (const name of entries) {
    if (SKIP.has(name)) continue;
    const src = path.join(process.cwd(), name);
    const dest = path.join(DIST, name);
    await fs.copy(src, dest);
    console.log(`    • copied ${name}`);
  }
}

// ——————————————————————————————————————————————————————————————————————————————————
// BUILD CSS: minify + optional PurgeCSS
// ——————————————————————————————————————————————————————————————————————————————————
async function buildCSS(dest, usePurge) {
  const files = glob.sync(PATTERNS.css);
  if (!files.length) {
    console.warn("⚠️  No CSS files found.");
    return;
  }
  await Promise.all(files.map(async (file) => {
    const css    = await fs.readFile(file, "utf8");
    const plugins = [ atImport() ];
    if (usePurge) {
      plugins.push(
        purgecss({
          content: [ PATTERNS.html, PATTERNS.js ],
          defaultExtractor: (c) => c.match(/[\w-/:]+(?<!:)/g) || []
        })
      );
    }
    plugins.push(cssnano());
    const result = await postcss(plugins).process(css, { from: file });
    const rel     = path.relative("css", file);
    const outFile = path.join(dest, "css", rel);
    await fs.mkdirp(path.dirname(outFile));
    await fs.writeFile(outFile, result.css, "utf8");
    console.log(`    • CSS → ${path.join(path.basename(dest), "css", rel)}`);
  }));
}

// ——————————————————————————————————————————————————————————————————————————————————
// BUILD JS: minify-only with Terser
// ——————————————————————————————————————————————————————————————————————————————————
async function buildJS(dest) {
  const entries = glob.sync(PATTERNS.js);
  if (!entries.length) {
    console.warn("⚠️  No JS files found.");
    return;
  }
  await Promise.all(entries.map(async (entry) => {
    const code   = await fs.readFile(entry, "utf8");
    const result = await minify(code, { format: { comments: false } });
    if (result.error) throw result.error;
    const rel     = path.relative("js", entry);
    const outFile = path.join(dest, "js", rel);
    await fs.mkdirp(path.dirname(outFile));
    await fs.writeFile(outFile, result.code, "utf8");
    console.log(`    • JS  → ${path.join(path.basename(dest), "js", rel)}`);
  }));
}

// ——————————————————————————————————————————————————————————————————————————————————
// COPY IMAGES UNTOUCHED
// ——————————————————————————————————————————————————————————————————————————————————
async function copyImages(dest) {
  const imgs = glob.sync(PATTERNS.img);
  if (!imgs.length) {
    console.warn("⚠️  No images found.");
    return;
  }
  await Promise.all(imgs.map(async (img) => {
    const rel     = path.relative("img", img);
    const outFile = path.join(dest, "img", rel);
    await fs.mkdirp(path.dirname(outFile));
    await fs.copy(img, outFile);
    console.log(`    • IMG → ${path.join(path.basename(dest), "img", rel)}`);
  }));
}

// ——————————————————————————————————————————————————————————————————————————————————
// MAIN
// ——————————————————————————————————————————————————————————————————————————————————
(async () => {
  try {
    console.log(`→ Building version ${version}…`);
    await cleanDist();

    console.log("  • Copying root assets…");
    await copyRootAssets();

    console.log("  • Building site CSS (min + purge) → css/");
    await buildCSS(DIST, true);

    console.log("  • Building site JS (min) → js/");
    await buildJS(DIST);

    const libDest = LIB_DIR(version);
    console.log(`  • Creating library folder ${libDest}`);
    await fs.mkdirp(libDest);

    console.log("  • Building lib CSS (min only) → @v…/css/");
    await buildCSS(libDest, false);

    console.log("  • Building lib JS (min only) → @v…/js/");
    await buildJS(libDest);

    console.log("  • Copying images → @v…/img/");
    await copyImages(libDest);

    console.log("✅ Build complete!");
  } catch (err) {
    console.error("❌ Build failed:", err);
    process.exit(1);
  }
})();
