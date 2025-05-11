export const flags = ['config', 'force', 'verbose', 'json'] as const;

type AvailableFlagsType = (typeof flags)[number];

type AvailableFlagsMap = {
    [flags in AvailableFlagsType]: UserInputMetadataOptions;
};

interface UserInputMetadata {
    name: string;
    type: UserInputMetadataTypes;
    message: string;
    value: string;
}

export interface FlagsNames {
    name: AvailableFlagsType;
    alt: string;
}
interface UserInputMetadataOptions
    extends Omit<UserInputMetadata, 'value' | 'name'> {
    description: string;
    isArgument: boolean;
    name: FlagsNames;
}

export interface UserInputMetadataInput extends UserInputMetadataOptions {
    input: string;
}

export interface UserInputMetadataConfirm extends UserInputMetadataOptions {
    confirm: boolean;
}

export interface UserInputMetadataList extends UserInputMetadataOptions {
    value: string;
    list: ChoiceOps[];
}

export const userInputMetadata = ['input', 'confirm', 'list'] as const;

type UserInputMetadataTypes = (typeof userInputMetadata)[number];

export interface ChoiceOps {
    value: string;
    name: string;
    short: string;
}

export const availableFlags: AvailableFlagsMap = {
    config: {
        name: {
            name: 'config',
            alt: 'c',
        },
        description:
            'Specify the config file for the project (default: minimalify.config.js)',
        isArgument: false,
        message: 'Path to the config file',
        type: 'input',
        input: 'minimalify.config.js',
    } as UserInputMetadataInput,
    force: {
        name: {
            name: 'force',
            alt: 'f',
        },
        description: 'Force overwrite the config file if it exists',
        isArgument: false,
        message: 'Force overwrite the config file if it exists',
        type: 'confirm',
        confirm: false,
    } as UserInputMetadataConfirm,
    verbose: {
        name: {
            name: 'verbose',
            alt: 'v',
        },
        description: 'Enable verbose logging',
        isArgument: false,
        message: 'Enable verbose logging',
        type: 'confirm',
        confirm: false,
    } as UserInputMetadataConfirm,
    json: {
        name: {
            name: 'json',
            alt: 'j',
        },
        description: 'Output in JSON format',
        isArgument: false,
        message: 'Output in JSON format',
        type: 'confirm',
        confirm: false,
    } as UserInputMetadataConfirm,
};
