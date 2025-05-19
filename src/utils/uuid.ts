import crypto from 'crypto';

/**
 *
 * @returns UUID v4
 */
export const generateUUID = () => crypto.randomUUID();
