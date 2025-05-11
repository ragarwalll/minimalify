/**
 * Custom error class for bundle errors. which accept custom message
 */
export class BundleError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'BundleError';
    }
    /**
     * Custom toString method to return the error message
     * @returns {string} the error message
     */
    override toString() {
        return `${this.name}: ${this.message}`;
    }
}
