"use strict";

const fs = require("fs-extra");
const path = require("path");
const glob = require("glob");
const postcss = require("postcss");
const atImport = require("postcss-import");
const cssnano = require("cssnano");
const purgecss = require("@fullhuman/postcss-purgecss").default;
const { minify } = require("terser");

// ——————————————————————————————————————————————————————————————————————————————————
// CONFIG
// ——————————————————————————————————————————————————————————————————————————————————
const PATTERNS = {
  html: "index.html",
  css: "css/**/*.css",
  js: "js/**/*.js",
  img: "img/**/*",
  templates: "templates/**/*"
};

const SCHEMA_FILE = path.join(__dirname, '..', 'src', 'config', "schema.json");

const DIST = 'dist';
const DIST_PATH = path.resolve(DIST);
const LIB_DIR = (v) => path.join(DIST, `@${v}`);
const version =
  process.argv[2] || fs.readFileSync("VERSION", "utf8").trim();

const SKIP = new Set([
  "node_modules",
  DIST,
  "package.json",
  "VERSION",
  "templates",
  "package-lock.json",
  path.basename(__filename)
]);

// ——————————————————————————————————————————————————————————————————————————————————
// CLEAN DIST
// ——————————————————————————————————————————————————————————————————————————————————
/**
 * Remove and re-create the dist directory.
 * @returns {Promise<void>}
 */
const cleanDist = async () => {
  await fs.remove(DIST);
  await fs.mkdirp(DIST);
};

// ——————————————————————————————————————————————————————————————————————————————————
// COPY ROOT ASSETS
// ——————————————————————————————————————————————————————————————————————————————————
/**
 * Copy all top-level files and directories into dist,
 * skipping entries in SKIP.
 * @returns {Promise<void>}
 */
const copyRootAssets = async () => {
  const entries = await fs.readdir(process.cwd());
  for (const name of entries) {
    if (SKIP.has(name)) continue;
    await fs.copy(name, path.join(DIST, name));
    console.log(`    • copied ${name}`);
  }
};

// ——————————————————————————————————————————————————————————————————————————————————
// COPY SCHEMA
// ——————————————————————————————————————————————————————————————————————————————————
/**
 * Read version from root schema.json, then write a copy
 * as minimalify@{version}.json under dist/schema/.
 * @returns {Promise<void>}
 */
const copySchema = async () => {
  const schemaSrc = path.resolve(SCHEMA_FILE);
  if (!await fs.pathExists(schemaSrc)) {
    console.warn("⚠️  schema.json not found in project root.");
    return;
  }
  const schemaData = await fs.readJSON(schemaSrc);
  const schemaVer = schemaData.version;
  if (!schemaVer) {
    console.warn("⚠️  No version field in schema.json.");
    return;
  }
  const destDir = path.join(DIST, "schema");
  await fs.mkdirp(destDir);
  const outName = `minimalify@${schemaVer}.json`;
  const outPath = path.join(destDir, outName);
  await fs.writeJSON(outPath, schemaData, { spaces: 2 });
  console.log(`    • schema → schema/${outName}`);

  const outNameLatest = `minimalify@latest.json`;
  const outPathLatest = path.join(destDir, outNameLatest);
  await fs.writeJSON(outPathLatest, schemaData, { spaces: 2 });
  console.log(`    • schema → schema/${outNameLatest}`);
};

// ——————————————————————————————————————————————————————————————————————————————————
// BUILD CSS
// ——————————————————————————————————————————————————————————————————————————————————
/**
 * Process, purge (optional), and minify CSS into dest.
 * @param {string} dest
 * @param {boolean} usePurge
 * @returns {Promise<void>}
 */
const buildCSS = async (dest, usePurge) => {
  const files = glob.sync(PATTERNS.css);
  if (!files.length) {
    console.warn("⚠️ No CSS files found.");
    return;
  }
  await Promise.all(
    files.map(async (file) => {
      const css = await fs.readFile(file, "utf8");
      const plugins = [atImport()];
      if (usePurge) {
        plugins.push(
          purgecss({
            content: [PATTERNS.html, PATTERNS.js],
            defaultExtractor: (c) => c.match(/[\w-/:]+(?<!:)/g) || []
          })
        );
      }
      plugins.push(cssnano());
      const result = await postcss(plugins).process(css, { from: file });
      const rel = path.relative("css", file);
      const outFile = path.join(dest, "css", rel);
      await fs.mkdirp(path.dirname(outFile));

      const minifiedFileName = outFile.replace(/\.css$/, ".min.css");

      await fs.writeFile(minifiedFileName, result.css, "utf8");
      console.log(`    • CSS → ${path.join(path.basename(dest), "css", rel.replace(/\.css$/, ".min.css"))}`);
    })
  );
};

// ——————————————————————————————————————————————————————————————————————————————————
// BUILD JS
// ——————————————————————————————————————————————————————————————————————————————————
/**
 * Minify JavaScript files into dest.
 * @param {string} dest
 * @returns {Promise<void>}
 */
const buildJS = async (dest) => {
  const entries = glob.sync(PATTERNS.js);
  if (!entries.length) {
    console.warn("⚠️ No JS files found.");
    return;
  }
  await Promise.all(
    entries.map(async (entry) => {
      const code = await fs.readFile(entry, "utf8");
      const result = await minify(code, { format: { comments: false } });
      if (result.error) throw result.error;
      const rel = path.relative("js", entry);
      const outFile = path.join(dest, "js", rel);
      await fs.mkdirp(path.dirname(outFile));
      await fs.writeFile(outFile, result.code, "utf8");
      console.log(`    • JS  → ${path.join(path.basename(dest), "js", rel)}`);
    })
  );
};

// ——————————————————————————————————————————————————————————————————————————————————
// BUILD TEMPLATES
// ——————————————————————————————————————————————————————————————————————————————————
/**
 * Copy template files into dest.
 * @param {string} dest
 * @returns {Promise<void>}
 */
const buildTemplates = async (dest) => {
  const entries = glob.sync(PATTERNS.templates);
  if (!entries.length) {
    console.warn("⚠️ No templates found.");
    return;
  }
  await Promise.all(
    entries.map(async (entry) => {
      const code = await fs.readFile(entry, "utf8");
      const rel = path.relative("templates", entry);
      const outFile = path.join(dest, "templates", rel);
      await fs.mkdirp(path.dirname(outFile));
      await fs.writeFile(outFile, code, "utf8");
      console.log(
        `    • Templates → ${path.join(path.basename(dest), "templates", rel)}`
      );
    })
  );
};

// ——————————————————————————————————————————————————————————————————————————————————
// COPY IMAGES
// ——————————————————————————————————————————————————————————————————————————————————
/**
 * Copy image files into dest.
 * @param {string} dest
 * @returns {Promise<void>}
 */
const copyImages = async (dest) => {
  const imgs = glob.sync(PATTERNS.img);
  if (!imgs.length) {
    console.warn("⚠️ No images found.");
    return;
  }
  await Promise.all(
    imgs.map(async (img) => {
      const rel = path.relative("img", img);
      const outFile = path.join(dest, "img", rel);
      await fs.mkdirp(path.dirname(outFile));
      await fs.copy(img, outFile);
      console.log(`    • IMG → ${path.join(path.basename(dest), "img", rel)}`);
    })
  );
};

// ——————————————————————————————————————————————————————————————————————————————————
// GENERATE LISTING.JSON IN SUBDIRECTORIES
// ——————————————————————————————————————————————————————————————————————————————————
/**
 * Generate a `listing.json` in dir containing an array of
 * { name: string, isDirectory: boolean } entries.
 * @param {string} dir Absolute path to directory
 */
const makeJsonListing = (dir) => {
  const items = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.name[0] !== ".")
    .map((d) => ({
      name: d.name,
      isDirectory: d.isDirectory()
    }));
  const outPath = path.join(dir, "listing.json");
  fs.writeFileSync(outPath, JSON.stringify(items, null, 2), "utf8");
};

/**
 * Recursively walk dir and generate listing.json in every
 * subdirectory (skipping the root).
 * @param {string} dir Absolute path to start from
 */
const walkAndList = (dir) => {
  if (dir !== DIST_PATH) {
    makeJsonListing(dir);
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name[0] !== ".") {
      walkAndList(path.join(dir, entry.name));
    }
  }
};

// ——————————————————————————————————————————————————————————————————————————————————
// MAIN
// ——————————————————————————————————————————————————————————————————————————————————
(async () => {
  try {
    console.log(`→ Building version ${version}…`);
    await cleanDist();

    console.log("  • Copying root assets…");
    await copyRootAssets();

    console.log("  • Copying schema.json → dist/schema/minimalify@{version}.json");
    await copySchema();

    console.log("  • Building site CSS (min + purge) → css/");
    await buildCSS(DIST, true);

    console.log("  • Building site JS (min) → js/");
    await buildJS(DIST);

    // Build the versioned library
    const libDest = LIB_DIR(`v${version}`);
    console.log(`  • Creating library folder ${libDest}`);
    await fs.mkdirp(libDest);

    console.log("  • Building lib CSS (min only) → @v…/css/");
    await buildCSS(libDest, false);

    console.log("  • Building lib JS (min only) → @v…/js/");
    await buildJS(libDest);

    console.log("  • Building lib templates → @v…/templates/");
    await buildTemplates(libDest);

    console.log("  • Copying images → @v…/img/");
    await copyImages(libDest);

    // Create @latest by copying v{version}
    const latestDest = LIB_DIR("latest");
    await fs.remove(latestDest);
    await fs.copy(libDest, latestDest);
    console.log(`  • Copied @v${version} → @latest`);

    // Now package both into dist/dist
    const packageDir = path.join(DIST, "dist");
    await fs.remove(packageDir);
    await fs.mkdirp(packageDir);

    // Copy @v{version} and @latest
    for (const src of [libDest, latestDest]) {
      const name = path.basename(src); // "@vX" or "@latest"
      await fs.copy(src, path.join(packageDir, name));
      console.log(`    • ${name} → dist/${name}`);
    }

    // Copy schema into dist/dist/schema
    const schemaSrc = path.join(DIST, "schema");
    const schemaDest = path.join(packageDir, "schema");
    await fs.copy(schemaSrc, schemaDest);
    console.log("    • schema → dist/schema");

    // Clean up the root dist folder
    await Promise.all([
      fs.remove(libDest),
      fs.remove(latestDest),
      fs.remove(schemaSrc)
    ]);

    console.log("  • Generating listing.json in all subdirectories…");
    walkAndList(path.join(DIST_PATH, "dist"));

    console.log("✅ Build complete!");
  } catch (err) {
    console.error("❌ Build failed:", err);
    process.exit(1);
  }
})();

