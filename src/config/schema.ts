export const MinimalifySchema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'MinimalifyConfig',
    type: 'object',
    properties: {
        srcDir: {
            type: 'string',
            description: 'the starting point of the project',
        },
        outDir: {
            type: 'string',
            description: 'the output directory of the project',
        },
        sharedDomains: {
            type: 'array',
            description: 'the processable assets domains',
            items: {
                type: 'string',
            },
        },
        htmlMinify: {
            $ref: '#/$defs/HTMLMinifierOptions',
        },
        templatesDir: {
            type: 'string',
            description: 'templates dir',
        },
        images: {
            type: 'object',
            description: 'images opts',
            properties: {
                optimize: {
                    type: 'boolean',
                },
                outDir: {
                    type: 'string',
                },
                supportedFormats: {
                    type: 'array',
                    items: {
                        type: 'string',
                    },
                },
            },
            required: ['optimize', 'outDir', 'supportedFormats'],
            additionalProperties: false,
        },
        dev: {
            type: 'object',
            description: 'dev options',
            properties: {
                port: {
                    type: 'integer',
                },
            },
            required: ['port'],
            additionalProperties: false,
        },
        customDomain: {
            type: 'string',
            description: 'custom domain for the project',
            default: '',
            pattern: '^(https?://)?([a-zA-Z0-9-]+\\.)+[a-zA-Z]{2,}(/.*)?$',
        },
        seo: {
            type: 'object',
            description: 'SEO options',
            properties: {
                siteUrl: {
                    type: 'string',
                },
                title: {
                    type: 'string',
                },
                description: {
                    type: 'string',
                },
                titleSuffix: {
                    type: 'string',
                },
                defaultDescription: {
                    type: 'string',
                },
                twitterCard: {
                    type: 'string',
                },
            },
            required: [
                'siteUrl',
                'title',
                'description',
                'titleSuffix',
                'defaultDescription',
                'twitterCard',
            ],
            additionalProperties: false,
        },
        plugins: {
            type: 'array',
            description: 'minimalify plugins',
            items: {
                type: 'string',
            },
        },
    },
    required: [
        'srcDir',
        'outDir',
        'sharedDomains',
        'htmlMinify',
        'templatesDir',
        'images',
        'dev',
        'plugins',
    ],
    additionalProperties: false,
    $defs: {
        HTMLMinifierOptions: {
            type: 'object',
            description: 'Options for HTML minification',
            properties: {
                collapseWhitespace: {
                    type: 'boolean',
                },
                removeComments: {
                    type: 'boolean',
                },
                removeRedundantAttributes: {
                    type: 'boolean',
                },
                minifyCSS: {
                    type: 'boolean',
                },
                minifyJS: {
                    type: 'boolean',
                },
            },
            required: [
                'collapseWhitespace',
                'removeComments',
                'removeRedundantAttributes',
                'minifyCSS',
                'minifyJS',
            ],
            additionalProperties: false,
        },
    },
};
