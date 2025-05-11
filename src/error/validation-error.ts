/**
 * Custom error class for validation errors. which accept custom message
 */
export class ValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ValidationError';
    }
    /**
     * Custom toString method to return the error message
     * @returns {string} the error message
     */
    override toString() {
        return `${this.name}: ${this.message}`;
    }
}
