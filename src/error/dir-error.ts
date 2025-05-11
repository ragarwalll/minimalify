/**
 * Custom error class for directory errors. which accept custom message
 */
export class DirError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'DirError';
    }
    /**
     * Custom toString method to return the error message
     * @returns {string} the error message
     */
    override toString() {
        return `${this.name}: ${this.message}`;
    }
}
