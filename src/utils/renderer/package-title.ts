import gradient from 'gradient-string';
import { ASCII_PACKAGE_NAME } from '@/utils/constants/ascii-text.js';

// colors inpired by SAP Evening Horizon theme
const eveningHorizon = {
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
    const colored = gradient(Object.values(eveningHorizon));
    console.log(colored.multiline(ASCII_PACKAGE_NAME));
};
