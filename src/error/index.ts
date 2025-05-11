import { BundleError } from './bundle-error.js';
import { DirError } from './dir-error.js';
import { FileError } from './file-error.js';
import { GraphError } from './graph-error.js';
import { HTMLError } from './html-error.js';
import { PluginError } from './plugin-error.js';
import { ValidationError } from './validation-error.js';

// Define an array of error types
const errorTypes = [
    BundleError,
    DirError,
    FileError,
    GraphError,
    HTMLError,
    PluginError,
    ValidationError,
];

// Check if an error is an instance of any error type
function isKnownError(error: unknown): boolean {
    return errorTypes.some((ErrorType) => error instanceof ErrorType);
}

// Convert an unknown error to a specific error type
function toKnownError(
    error: unknown,
):
    | BundleError
    | DirError
    | FileError
    | GraphError
    | HTMLError
    | PluginError
    | ValidationError
    | null {
    for (const ErrorType of errorTypes) {
        if (error instanceof ErrorType) {
            return error as
                | BundleError
                | DirError
                | FileError
                | GraphError
                | HTMLError
                | PluginError
                | ValidationError;
        }
    }
    return null; // Return null if the error doesn't match any known type
}

export { errorTypes, isKnownError, toKnownError };
