/**
 * Custom error class for file errors. which accept custom message
 */
export class FileError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'FileError';
    }
    /**
     * Custom toString method to return the error message
     * @returns {string} the error message
     */
    override toString() {
        return `${this.name}: ${this.message}`;
    }
}
