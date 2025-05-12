/**
 * Custom error class for not implemented errors. which accept custom message
 */
export class NotImplementedError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'NotImplementedError';
    }
    /**
     * Custom toString method to return the error message
     * @returns {string} the error message
     */
    override toString() {
        return `${this.name}: ${this.message}`;
    }
}
