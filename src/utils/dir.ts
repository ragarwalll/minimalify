import fs from 'fs';
import path from 'path';
import { DirError } from '@/error/dir-error.js';

/**
 * Ensure that a directory exists.
 *
 * @param dir the directory to ensure
 * @returns void
 * @throws {DirError} if the path is not a directory
 * */
export const cleanDir = (dir: string) => {
    if (!fs.existsSync(dir)) {
        return;
    }

    // check if the path is a directory
    if (!fs.lstatSync(dir).isDirectory()) {
        throw new DirError(`Path ${dir} is not a directory.`);
    }

    // remove all files and directories in the directory
    fs.readdirSync(dir).forEach((file) => {
        const filePath = path.join(dir, file);
        if (fs.lstatSync(filePath).isDirectory()) {
            fs.rmdirSync(filePath, { recursive: true });
        } else {
            fs.unlinkSync(filePath);
        }
    });
};

/**
 * Ensure that a directory exists.
 *
 * @param dir the directory to ensure
 * @returns void
 * @throws {DirError} if the path is not a directory
 */
export const ensureDir = (dir: string) => {
    if (fs.existsSync(dir)) {
        return;
    }

    // check if the path is a directory
    if (fs.existsSync(dir) && !fs.lstatSync(dir).isDirectory()) {
        throw new DirError(`Path ${dir} is not a directory.`);
    }

    // create the directory
    fs.mkdirSync(dir, { recursive: true });
};
