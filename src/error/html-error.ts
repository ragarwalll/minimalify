/**
 * Custom error class for html errors. which accept custom message
 */
export class HTMLError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'HTMLError';
    }
    /**
     * Custom toString method to return the error message
     * @returns {string} the error message
     */
    override toString() {
        return `${this.name}: ${this.message}`;
    }
}
