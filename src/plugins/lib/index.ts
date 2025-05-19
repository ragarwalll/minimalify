import { type SupportedPlugins } from '@/utils/constants/supported-plugins.js';
import { type MinimalifyPlugin } from '../typings.js';

import { accessibility } from './accessibility.js';
import { imageOptimizer } from './image-optimizer.js';
import { perfMonitor } from './perf-monitor.js';
import { spa } from './spa.js';
import { bundleAnalyzer } from './bundle-analyzer.js';
import { markdown } from './markdown.js';
import { seo } from './seo.js';
import { sitemap } from './sitemap.js';
import { versionAssets } from './version-assets.js';
import { customDomain } from './custom-domain.js';
import { favicon } from './favicon.js';

export const plugins: Record<SupportedPlugins, MinimalifyPlugin> = {
    accessibility: accessibility,
    'image-optimizer': imageOptimizer,
    'custom-domain': customDomain,
    'perf-monitor': perfMonitor,
    spa: spa,
    'bundle-analyzer': bundleAnalyzer,
    markdown: markdown,
    seo: seo,
    sitemap: sitemap,
    'version-assets': versionAssets,
    favicon: favicon,
};
