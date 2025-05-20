import path from 'path';
import { type PackageJson } from 'type-fest';
import { CLI_DIR } from '@/utils/constants/dir.js';
import { readJSONSync } from '@/lib/fs-extra.js';

export const getPackageJSON = () => {
    let packageManagerPath = path.join(CLI_DIR, 'package.json');

    // for windows
    packageManagerPath = packageManagerPath.replace('file:\\', '');

    // for linux
    // for mac
    packageManagerPath = packageManagerPath.replace('file:', '');

    const packageManagerContent = readJSONSync<PackageJson>(packageManagerPath);

    return packageManagerContent;
};

export const PACKAGE_JSON = getPackageJSON();
export const PACKAGE_NAME = PACKAGE_JSON.name ?? 'cli';
export const PACKAGE_VERSION = PACKAGE_JSON.version ?? '0.0.0';
export const PACKAGE_DESCRIPTION =
    PACKAGE_JSON.description ?? 'No description available.';
export const GITHUB_LOCATION =
    typeof PACKAGE_JSON.repository === 'object' &&
    'url' in PACKAGE_JSON.repository
        ? PACKAGE_JSON.repository.url
        : '';
