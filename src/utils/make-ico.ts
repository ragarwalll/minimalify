/**
 * Pack an array of PNG Buffers into one .ico Buffer.
 * No external deps.
 *
 * @param pngs  Array of PNG Buffers (must include IHDR chunk)
 * @returns     Buffer containing a valid ICO
 */
export function makeIco(pngs: Buffer[]): Buffer {
    const count = pngs.length;
    // 1) ICONDIR header: 6 bytes
    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0); // reserved
    header.writeUInt16LE(1, 2); // type = 1 (icon)
    header.writeUInt16LE(count, 4); // number of images

    // 2) ICONDIRENTRY array: 16 bytes each
    const dir = Buffer.alloc(16 * count);
    let offset = header.length + dir.length;

    pngs.forEach((buf, i) => {
        // read width/height from PNG IHDR chunk (bytes 16–19, 20–23)
        const width = buf.readUInt32BE(16);
        const height = buf.readUInt32BE(20);

        const entryOffset = i * 16;
        dir.writeUInt8(width >= 256 ? 0 : width, entryOffset + 0);
        dir.writeUInt8(height >= 256 ? 0 : height, entryOffset + 1);
        dir.writeUInt8(0, entryOffset + 2); // palette size (0 = none)
        dir.writeUInt8(0, entryOffset + 3); // reserved
        dir.writeUInt16LE(1, entryOffset + 4); // color planes
        dir.writeUInt16LE(32, entryOffset + 6); // bits per pixel
        dir.writeUInt32LE(buf.length, entryOffset + 8); // data size
        dir.writeUInt32LE(offset, entryOffset + 12); // data offset

        offset += buf.length;
    });

    // 3) concatenate header + directory + all PNG blobs
    return Buffer.concat([header, dir, ...pngs], offset);
}
