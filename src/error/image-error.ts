/**
 * Custom error class for image errors. which accept custom message
 */
export class ImageError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ImageError';
    }
    /**
     * Custom toString method to return the error message
     * @returns {string} the error message
     */
    override toString() {
        return `${this.name}: ${this.message}`;
    }
}
