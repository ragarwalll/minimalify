/**
 * Remove ANSI escape codes from a string.
 * Supports CSI sequences and other common ANSI codes.
 */

const ANSI_REGEX =
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;

/**
 * Strip ANSI escape codes from the input string.
 * @param input String potentially containing ANSI codes
 * @returns Clean string without ANSI codes
 */
const stripAnsi = (input: string): string => {
    return input.replace(ANSI_REGEX, '');
};

export default stripAnsi;
