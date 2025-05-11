import fs from 'fs';
import path from 'path';
import { HTMLHint } from 'htmlhint';
import stylelint from 'stylelint';
import { ESLint } from 'eslint';
import fg from 'fast-glob';
import { type MinimalifyPlugin } from '../typings.js';
import { PluginError } from '@/error/plugin-error.js';

/**
 * lint plugin
 *
 * Runs HTMLHint on pages, stylelint on CSS, and ESLint on JS.
 * Fails the build on any errors.
 */
const lint: MinimalifyPlugin = {
    name: 'lint',

    async onPage(cfg, pagePath, _doc) {
        let hasErrors = false;

        // 1) HTMLHint
        const html = fs.readFileSync(pagePath, 'utf8');
        const htmlIssues = HTMLHint.verify(html, cfg.htmlhint || {});
        htmlIssues.forEach((e) => {
            console.error(
                `✏️ [htmlhint] ${pagePath}:${e.line}:${e.col} ${e.message}`,
            );
            hasErrors = true;
        });

        // 2) stylelint on all CSS sources
        const cssPatterns = cfg.css.srcGlob;
        const cssFiles = await fg(cssPatterns, {
            cwd: process.cwd(),
            absolute: true,
        });
        const styleResults = await stylelint.lint({
            files: cssFiles,
            formatter: 'string',
            config: cfg.stylelintConfig || undefined,
        });
        if (styleResults.errored) {
            console.error(styleResults.output);
            hasErrors = true;
        }

        // 3) ESLint on all JS sources
        const eslint = new ESLint({
            overrideConfig: cfg.eslintConfig || undefined,
            useEslintrc: true,
        });
        const jsPatterns = cfg.js.srcGlob;
        const jsFiles = await fg(jsPatterns, {
            cwd: process.cwd(),
            absolute: true,
        });
        const jsResults = await eslint.lintFiles(jsFiles);
        const formatter = await eslint.loadFormatter('stylish');
        const resultText = formatter.format(jsResults);
        if (jsResults.some((r) => r.errorCount > 0)) {
            console.error(resultText);
            hasErrors = true;
        }

        if (hasErrors) {
            throw new PluginError(`Lint errors detected, aborting build`);
        } else {
            console.log(
                `✏️ [lint] all checks passed for ${path.relative(cfg.srcDir, pagePath)}`,
            );
        }
    },
};

export default lint;
