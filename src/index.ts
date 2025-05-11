import {
    ABORTING_INSTALLTION,
    ERROR_CONTACT,
} from '@/utils/constants/message.js';
import { logger } from '@/utils/logger.js';
import { renderPackageTitle } from '@/utils/renderer/package-title.js';
import { initCommands } from './cli/index.js';

const renderer = async () => {
    // render package title
    renderPackageTitle();

    // initialize cli with commander
    initCommands();
};

renderer().catch((error) => {
    logger.error(ABORTING_INSTALLTION);
    if (error instanceof Error) logger.error(error.message);
    else logger.error(ERROR_CONTACT);

    process.exit(1);
});
