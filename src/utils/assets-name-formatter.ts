import { createHash } from 'crypto';
import path from 'path';
import { IMG_BUNDLE_DIR } from './constants/bundle.js';
import { type MinimalifyConfig } from '@/config/struct.js';

/**
 * Format the image name and path for the given value.
 * @param cfg the config object
 * @param value the value of the image src
 * @param relPage the relative path of the page
 * @returns an object containing the file name and file path
 */
export const formatImageName = (
    cfg: MinimalifyConfig,
    value: string,
    relPage: string,
): {
    fileName: string;
    filePath: string;
} => {
    // check if value starts with a https/http
    if (/^https?:\/\//.test(value)) {
        const fileName =
            createHash('md5').update(value).digest('hex') + path.extname(value);
        return {
            fileName,
            filePath: path.join(IMG_BUNDLE_DIR, fileName),
        };
    } else {
        return {
            fileName: path.basename(value),
            filePath: path.relative(
                path.join(cfg.srcDir, path.dirname(relPage)),
                path.join(
                    cfg.srcDir,
                    IMG_BUNDLE_DIR,
                    path.dirname(relPage),
                    value,
                ),
            ),
        };
    }
};
