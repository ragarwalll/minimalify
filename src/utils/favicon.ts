import { ImageError } from '@/error/image-error.js';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import { optimize } from 'svgo';
import { type TagDetailsMap } from './tag-modifier-merger.js';
import { type FaviconConfig, type MinimalifyConfig } from '@/config/struct.js';
import { makeIco } from './make-ico.js';

export interface SizesGenerated {
    sizeKey: string;
    width: number;
    height: number;
    outPath: string;
}

interface ImageSize {
    width: number;
    height: number;
}

// save all favicon sizes in a map
export const faviconSizes = new Map<string, ImageSize>([
    ['16x16', { width: 16, height: 16 }],
    ['32x32', { width: 32, height: 32 }],
    ['48x48', { width: 48, height: 48 }],
    ['57x57', { width: 57, height: 57 }],
    ['60x60', { width: 60, height: 60 }],
    ['70x70', { width: 70, height: 70 }],
    ['76x76', { width: 76, height: 76 }],
    ['114x114', { width: 114, height: 114 }],
    ['120x120', { width: 120, height: 120 }],
    ['144x144', { width: 144, height: 144 }],
    ['152x152', { width: 152, height: 152 }],
    ['180x180', { width: 180, height: 180 }],
    ['192x192', { width: 192, height: 192 }],
    ['228x228', { width: 228, height: 228 }],
    ['256x256', { width: 256, height: 256 }],
    ['310x310', { width: 310, height: 310 }],
    ['384x384', { width: 384, height: 384 }],
    ['512x512', { width: 512, height: 512 }],
]);

/**
 * Get image dimensions (width & height) for a given file path or Buffer.
 *
 * @param  source  Path to image file
 * @returns        Promise resolving to width and height
 */
export const getImageSize = async (source: string): Promise<ImageSize> => {
    // Load the image via sharp and read metadata
    const meta = await sharp(source).metadata();

    if (typeof meta.width !== 'number' || typeof meta.height !== 'number') {
        throw new ImageError('Could not determine image dimensions');
    }

    // check if size is in the map
    // if not, return the closest size
    const closestSize = Array.from(faviconSizes.entries()).reduce(
        (prev, curr) => {
            const prevDiff =
                Math.abs(prev[1].width - meta.width!) +
                Math.abs(prev[1].height - meta.height!);
            const currDiff =
                Math.abs(curr[1].width - meta.width!) +
                Math.abs(curr[1].height - meta.height!);

            return currDiff < prevDiff ? curr : prev;
        },
    );
    return closestSize[1];
};

/**
 * Get the required favicon sizes to be generate from a given image.
 * eg. if a 1024x1024 image is provided, from @getImageSize(),
 * we will get the closest size from the map, which is 512x512.
 * Then we will return all the sizes that are smaller than 512x512.
 * Along with 512x512, and not 1024x1024, becuase we don't have that
 * in @faviconSizes
 * @param  source  Path to image file
 * @returns        Array of sizes
 */
export const getFaviconSizes = async (source: string) => {
    const { width, height } = await getImageSize(source);

    // get all sizes that are smaller than the given size
    const indexOfCurrentSize = Array.from(faviconSizes.entries()).findIndex(
        ([, size]) => size.width === width && size.height === height,
    );

    return Array.from(faviconSizes.entries()).slice(0, indexOfCurrentSize + 1);
};

/**
 * For a given image, generate one .ico file containing
 * all the required sizes (16x16… up to the image’s closest
 * registered size).
 *
 * @param source  Path to source image
 * @param dest    Path to destination .ico (must end in .ico)
 * @returns       Promise resolving to the path of the .ico
 */
export const generateFavicon = async (
    source: string,
    dest: string,
    cfg: Partial<FaviconConfig>,
): Promise<string> => {
    const imgBuffer = await fixFavicon(cfg, source);

    // 1) figure out which sizes we need
    const sizes = (await getFaviconSizes(source)).filter(([, { width }]) =>
        [16, 32, 48].includes(width),
    );
    if (!dest.endsWith('.ico')) {
        throw new ImageError('Destination file must have a .ico extension');
    }

    // 2) for each size, produce a PNG Buffer
    const pngBuffers: Buffer[] = await Promise.all(
        sizes.map(async ([, { width, height }]) => {
            return sharp(imgBuffer).resize(width, height).png().toBuffer();
        }),
    );

    // 3) pack them into a single ICO
    const icoBuffer = makeIco(pngBuffers);

    // 4) write to disk
    await fs.writeFile(dest, Buffer.from(icoBuffer));

    return dest;
};

/**
 * Generate all required favicon‐sized PNGs from a source image
 * into a destination folder.
 *
 * @param source     Path to the source image
 * @param destFolder Path to an existing or new folder to hold outputs
 * @returns          Array of absolute file paths for all generated images
 */
export async function generateAllSizes(
    source: string,
    destFolder: string,
    namePrefix: string,
    cfg: Partial<FaviconConfig>,
): Promise<SizesGenerated[]> {
    const sizesGenerated: SizesGenerated[] = [];
    const imgBuffer = await fixFavicon(cfg, source);

    // 1) figure out which sizes we need
    const sizes = await getFaviconSizes(source);

    // 2) ensure output folder exists
    await fs.mkdir(destFolder, { recursive: true });

    // 3) for each size, resize & write a PNG
    await Promise.all(
        sizes.map(async ([sizeKey, { width, height }]) => {
            const filename = `${namePrefix}-${sizeKey}.png`;
            const outPath = path.join(destFolder, filename);

            await sharp(imgBuffer)
                .resize(width, height)
                .withMetadata()
                .png()
                .toFile(outPath);

            sizesGenerated.push({ sizeKey, width, height, outPath });
            return outPath;
        }),
    );

    return sizesGenerated;
}

/**
 * Fixes the favicon by replacing the currentColor with the
 * svg_current_color from the config.
 * It also optimizes the svg using svgo.
 * @param cfg the config object
 * @param source the source image
 * @returns Buffer of the image
 */
export const fixFavicon = async (
    cfg: Partial<FaviconConfig>,
    source: string,
) => {
    const isSvg = source.endsWith('.svg');
    let fileValue = await fs.readFile(source, 'utf-8');
    if (isSvg) {
        fileValue = fileValue.replace(
            /currentColor/g,
            cfg.svg_current_color ?? '#000000',
        );

        const svgoResult = optimize(fileValue, {
            plugins: [
                {
                    name: 'inlineStyles',
                    params: { onlyMatchedOnce: false },
                },
                {
                    name: 'removeStyleElement',
                },
            ],
        });
        fileValue = svgoResult.data;
    }
    return Buffer.from(fileValue);
};

export const faviconAttrCollection: TagDetailsMap = {
    link: [
        {
            lookup: [{ name: 'rel', value: 'icon' }],
            valueAttr: 'href',
            setter: (cfg: MinimalifyConfig, _all, existing: string) =>
                cfg.seo?.title ?? existing,
        },
        {
            lookup: [{ name: 'rel', value: 'apple-touch-icon' }],
            valueAttr: 'href',
            setter: (cfg: MinimalifyConfig, _all, existing: string) =>
                cfg.seo?.title ?? existing,
        },
        {
            lookup: [{ name: 'rel', value: 'mask-icon' }],
            valueAttr: 'href',
            setter: (cfg: MinimalifyConfig, _all, existing: string) =>
                cfg.seo?.title ?? existing,
        },
    ],
    meta: [
        {
            lookup: [{ name: 'name', value: 'msapplication-TileColor' }],
            valueAttr: 'content',
            setter: (cfg: MinimalifyConfig, _all, existing: string) =>
                cfg.seo?.title ?? existing,
        },
        {
            lookup: [{ name: 'name', value: 'msapplication-TileImage' }],
            valueAttr: 'content',
            setter: (cfg: MinimalifyConfig, _all, existing: string) =>
                cfg.seo?.title ?? existing,
        },
        {
            lookup: [
                {
                    name: 'name',
                    value: /msapplication-[a-zA-Z]+[0-9]{1,3}x[0-9]{1,3}logo/gm,
                },
            ],
            valueAttr: 'content',
            setter: (cfg: MinimalifyConfig, _all, existing: string) =>
                cfg.seo?.title ?? existing,
        },
    ],
};
