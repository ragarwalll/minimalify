/**
 * Custom error class for plugin errors. which accept custom message
 */
export class PluginError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'PluginError';
    }
    /**
     * Custom toString method to return the error message
     * @returns {string} the error message
     */
    override toString() {
        return `${this.name}: ${this.message}`;
    }
}
