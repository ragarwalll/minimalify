# Minimalify

<img src="./logo/logo-dark.png" alt="Minimalify Logo" width="100" />

<br />

[![npm version](https://img.shields.io/npm/v/minimalify.svg)](https://www.npmjs.com/package/minimalify)
[![download](https://img.shields.io/npm/dw/minimalify.svg)](https://www.npmjs.com/package/minimalify)
[![License: Apache](https://img.shields.io/badge/License-Apache-blue.svg)](LICENSE)

Minimalify is a zero-dependency CLI/library for building blazing-fast, static HTML/CSS/JS sites with reusable components. Drop in your source, define a tiny config, run `minimalify build`, and get a fully inlined, minified `build/` folder ready for GitHub Pages or any static host.

## ⏛ Usage

```
minimalify [options] [command]

Minimalify is a zero-dependency CLI/library for building blazing-fast, static HTML/CSS/JS sites

Options:
  -V, --version    output the version number
  -v, --verbose    Enable verbose logging (default: false)
  -j, --json       Output in JSON format (default: false)
  -h, --help       display help for command

Commands:
  init [options]   Initialize the minimalify.config.js file.
  build [options]  Build the project using the minimalify.config.js file
  dev [options]    Launch the project using the minimalify.config.js file and watch for changes.
  help [command]   display help for command

 Generate awesome static site with @minimalify. Contribute at https://github.com/ragarwalll/minimalify.git
```

## 🚀 Features

- Fetch and bundle shared **base CSS**, **base JS**, and arbitrary **assets** (images, fonts, icons)
- Concatenate & minify your project’s CSS via PostCSS + cssnano
- Concatenate & minify your project’s JS via Terser
- Inline reusable HTML components with dynamic `{{param}}` and `{{children}}`
- Scan HTML/CSS for remote URLs (`<link>`, `<script>`, `<img>`, `url(...)`) and download them locally
- Purge unused CSS selectors (PurgeCSS) for minimal CSS footprint
- Minify final HTML (html-minifier-terser)
- Zero runtime dependencies in your final `build/`
- Incremental builds via a dependency DAG + BFS
- Caching of transform results (LRU caches) and HTTP assets (Bloom filter)
- Parallel transforms (p-limit worker pool)
- Merkle-style content-hash checks
- Dev server with HMR: CSS hot-swap, JS reload, page-diff via Morphdom

## 🎯 Installation

```bash
npm install --save-dev minimalify
```

## 🚧 Project Layout

```text
my-site/
├── src/
│   ├── css/
│   │   ├── base.min.css        ← shared, auto-downloaded
│   │   └── site.css            ← your custom styles
│   ├── js/
│   │   ├── base.min.js         ← shared, auto-downloaded
│   │   └── site.js             ← your custom scripts
│   ├── img/
│   │   └── logo.svg            ← project-specific images
│   ├── templates/
│   │   └── contacts.html       ← reusable component template
│   ├── index.html
│   └── about.html
├── minimalify.config.js        ← build configuration
└── package.json
```

## 🧑🏻‍🔧 Configuration (`minimalify.config.js`)

```js
module.exports = {
    srcDir: 'src',
    outDir: 'dist',
    sharedDomains: ['https://therahulagarwal.com'],
    html: {
        minify: true,
    },
    css: {
        minify: true,
    },
    js: {
        minify: true,
        minifyOptions: {},
    },
    images: {
        optimize: true,
        outDir: IMG_BUNDLE_DIR,
        supportedFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'],
        ignore: [],
    },
    templates: {
        dir: 'templates',
        sharedUri: [],
    },
    dev: {
        port: 3000,
    },
    cache: true,
    plugins: [
        'accessibility',
        'bundle-analyzer',
        'custom-domain',
        'image-optimizer',
        'markdown',
        'perf-monitor',
        'seo',
        'sitemap',
        'spa',
        'version-assets',
    ],
};
```

## 📦 Usage

### CLI

Add to your `package.json`:

```json
{
    "scripts": {
        "build": "minimalify build",
        "dev": "minimalify dev"
    }
}
```

Then:

```bash
npm run build    # production build
npm run dev      # dev server + HMR
```

### Programmatic API

```js
import { build, dev } from 'minimalify';

// production build
await build('minimalify.config.js');

// start dev server
await dev('minimalify.config.js');
```

## Components & Templates

Define a template with `{{param}}` and `{{children}}` in `src/templates/contacts.html`:

```html
<section class="contacts">
    <h2>Contact Us</h2>
    <ul>
        <li>Email: <a href="mailto:{{email}}">{{email}}</a></li>
        <li>Phone: <a href="tel:{{phone}}">{{phone}}</a></li>
    </ul>
    <div class="extra">{{children}}</div>
</section>
```

Use it in any page:

```html
<include-contacts email="hi@example.com" phone="+1234567890">
    <p>Office hours: Mon–Fri, 9am–5pm.</p>
</include-contacts>
```

Minimalify inlines, replaces `{{…}}`, and nests inner HTML automatically.

## 📑 GitHub Pages

1. Push the `build/` folder to `gh-pages` branch (or point Pages to `/build` on `main`).
2. Your site is live at `https://<user>.github.io/<repo>/`.

## 📄 License

This project is licensed under the Apache License 2.0. See the [LICENSE](LICENSE) file for details.
