import { type FlagsNames } from './constants/cli/flags.js';

// create new types combining FlagsNames and extra
interface FormatOptionsInput extends FlagsNames {
    extra?: string;
}

/**
 * Format the options for the CLI command.
 *
 * @param param0 the options to format
 * @param param0.name the name of the option
 * @param param0.alt the alternative name of the option
 * @param param0.extra the extra value to add to the option
 * @returns the formatted option string
 */
export const formatOptionInput = ({
    name = 'config',
    alt = '',
    extra = '',
}: FormatOptionsInput): string => {
    if (alt.length === 0) return `--${name} ${extra}`;
    if (alt.length === 1) return `-${alt}, --${name} ${extra}`;
    return `--${name}`;
};
