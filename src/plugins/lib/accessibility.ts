import fs from 'fs';
import { JSDOM } from 'jsdom';
import { type MinimalifyPlugin } from '../typings.js';
import { CLI_DIR } from '@/utils/constants/dir.js';
import path from 'path';
import { logger } from '@/utils/logger.js';
import { PluginError } from '@/error/plugin-error.js';

interface ViolationNode {
    target: string[];
}

interface Violation {
    id: string;
    impact: string;
    description: string;
    nodes: ViolationNode[];
}

/**
 * accessibility plugin
 *
 * Uses JSDOM + axe-core to audit each HTML page for
 * WCAG2A and WCAG2AA violations.
 * Fails build on any violation.
 */
export const accessibility: MinimalifyPlugin = {
    name: 'accessibility',

    async onPage(_cfg, pagePath, _doc) {
        logger.debug(`${this.name}-plugin: auditing page → ${pagePath}`);

        const html = fs.readFileSync(pagePath, 'utf8');
        const dom = new JSDOM(html, {
            runScripts: 'dangerously',
            resources: 'usable',
        });

        // Inject axe-core script into the JSDOM window
        const scriptEl = dom.window.document.createElement('script');
        const scriptFileUri = path.join(
            CLI_DIR,
            'node_modules',
            'axe-core',
            'axe.min.js',
        );
        const scriptFilePath = path.resolve(scriptFileUri);

        if (!fs.existsSync(scriptFilePath)) {
            logger.debug(
                `${this.name}-plugin: axe-core script not found at ${scriptFilePath}. Skipping accessibility check.`,
            );
            return;
        }

        scriptEl.textContent = fs.readFileSync(scriptFilePath, 'utf8');
        dom.window.document.head.appendChild(scriptEl);

        // Allow axe-core script to initialize
        await new Promise((r) => setTimeout(r, 50));

        // Run axe audit
        const results = await (dom.window as any).axe.run(dom.window.document, {
            runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
        });

        if (results.violations.length > 0) {
            logger.spinner.stop();

            logger.error(
                `${this.name}-plugin: ${results.violations.length} violations found`,
            );

            const _logHeaders = ['ID', 'Impact', 'Description', 'Target'];
            const _logRows: [string, string, string, string][] =
                results.violations.map((v: Violation) => {
                    return [
                        v.id,
                        v.impact,
                        v.description,
                        v.nodes
                            .map((node: ViolationNode) => node.target.join(' '))
                            .join(', '),
                    ];
                });
            logger.table(_logHeaders, _logRows);

            throw new PluginError(
                `accessibility violations detected in ${pagePath}`,
            );
        } else {
            logger.debug(`${this.name}-plugin: no violations found`);
        }
    },
};
