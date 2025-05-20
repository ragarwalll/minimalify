import gradient from '@/lib/terminal-gradient.js';
import { ASCII_PACKAGE_NAME } from '@/utils/constants/ascii-text.js';

const eveningTheme = {
    accent1: '#FFDF72',
    accent2: '#FF8CB2',
    accent3: '#FECBDA',
    accent4: '#FFAFED',
    accent5: '#D3B6FF',
};

/**
 * Renders the package title in the console with a gradient effect.
 */
export const renderPackageTitle = () => {
    const colored = gradient(Object.values(eveningTheme));
    console.log(colored.multiline(ASCII_PACKAGE_NAME));
};
