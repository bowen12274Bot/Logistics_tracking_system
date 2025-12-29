/**
 * Centralized Icon Library
 * All SVG path definitions for the application
 */

export type IconName =
    // Actions
    | 'refresh'
    | 'save'
    | 'delete'
    | 'edit'
    | 'close'
    | 'search'
    | 'filter'
    | 'clear'
    | 'copy'
    // Navigation
    | 'map'
    | 'home'
    | 'back'
    | 'forward'
    | 'fullscreen'
    | 'fullscreen-exit'
    | 'chevron-up'
    | 'chevron-down'
    | 'chevron-left'
    | 'chevron-right'
    // Status
    | 'check'
    | 'check-circle'
    | 'warning'
    | 'error'
    | 'info'
    | 'loading'
    // UI
    | 'menu'
    | 'more-vertical'
    | 'user'
    | 'logout'
    // Business
    | 'package'
    | 'truck'
    | 'billing'
    | 'contract'
    | 'clock'
    | 'route'

interface IconDefinition {
    viewBox?: string
    paths: string[]
}

export const ICONS: Record<IconName, IconDefinition> = {
    // Actions
    refresh: {
        paths: ['M12 6V3L8 7l4 4V8a4 4 0 1 1-3.9 5H6a6 6 0 1 0 6-7Z'],
    },
    save: {
        paths: [
            'M5 3h11l3 3v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z',
            'M7 3v6h8V3M7 13h8v6H7z',
        ],
    },
    delete: {
        paths: [
            'M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14Z',
        ],
    },
    edit: {
        paths: [
            'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7',
            'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
        ],
    },
    close: {
        paths: [
            'M18.3 5.71 12 12l6.3 6.29-1.41 1.42L10.59 13.4 4.29 19.71 2.88 18.3 9.17 12 2.88 5.71 4.29 4.29l6.3 6.3 6.3-6.3 1.41 1.42Z',
        ],
    },
    search: {
        paths: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.35-4.35'],
    },
    filter: {
        paths: ['M3 6h18M7 12h10M10 18h4'],
    },
    clear: {
        paths: [
            'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM8 12h8',
        ],
    },
    copy: {
        paths: [
            'M8 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2',
            'M16 4h2a2 2 0 0 1 2 2v2M10 2h8v8',
        ],
    },

    // Navigation
    map: {
        paths: [
            'M15 4 9 2 3 4v17l6-2 6 2 6-2V2l-6 2ZM9 4.1l6 2v13.8l-6-2V4.1Z',
        ],
    },
    home: {
        paths: [
            'M3 12l9-9 9 9M5 10v10a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1V10',
        ],
    },
    back: {
        paths: ['M19 12H5M12 19l-7-7 7-7'],
    },
    forward: {
        paths: ['M5 12h14M12 5l7 7-7 7'],
    },
    fullscreen: {
        paths: [
            'M4 4h6v2H6v4H4V4Zm14 0h2v6h-2V6h-4V4h4ZM4 14h2v4h4v2H4v-6Zm14 0h2v6h-6v-2h4v-4Z',
        ],
    },
    'fullscreen-exit': {
        paths: [
            'M10 4v2H6v4H4V4h6Zm10 0v6h-2V6h-4V4h6ZM4 14h2v4h4v2H4v-6Zm16 0v6h-6v-2h4v-4h2Z',
        ],
    },
    'chevron-up': {
        paths: ['M18 15l-6-6-6 6'],
    },
    'chevron-down': {
        paths: ['M6 9l6 6 6-6'],
    },
    'chevron-left': {
        paths: ['M15 18l-6-6 6-6'],
    },
    'chevron-right': {
        paths: ['M9 18l6-6-6-6'],
    },

    // Status
    check: {
        paths: ['M20 6L9 17l-5-5'],
    },
    'check-circle': {
        paths: [
            'M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20Zm-1.1-6.2 7.2-7.2-1.4-1.4-5.8 5.8-2.5-2.5-1.4 1.4 3.9 3.9Z',
        ],
    },
    warning: {
        paths: [
            'M12 2a1 1 0 0 1 .87.5l9 16A1 1 0 0 1 21 20H3a1 1 0 0 1-.87-1.5l9-16A1 1 0 0 1 12 2Zm0 6a1 1 0 0 0-1 1v4a1 1 0 1 0 2 0V9a1 1 0 0 0-1-1Zm0 9a1.25 1.25 0 1 0 0 2.5A1.25 1.25 0 0 0 12 17Z',
        ],
    },
    error: {
        paths: [
            'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM12 6a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0V7a1 1 0 0 1 1-1Zm0 11a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5Z',
        ],
    },
    info: {
        paths: [
            'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 5a1.25 1.25 0 1 1 0 2.5A1.25 1.25 0 0 1 12 7Zm-1 4h2v6h-2v-6Z',
        ],
    },
    loading: {
        paths: [
            'M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83',
        ],
    },

    // UI
    menu: {
        paths: ['M3 6h18v2H3V6Zm0 5h18v2H3v-2Zm0 5h18v2H3v-2Z'],
    },
    'more-vertical': {
        paths: [
            'M12 5.25a1.75 1.75 0 1 0 0 3.5 1.75 1.75 0 0 0 0-3.5ZM12 10.25a1.75 1.75 0 1 0 0 3.5 1.75 1.75 0 0 0 0-3.5ZM12 15.25a1.75 1.75 0 1 0 0 3.5 1.75 1.75 0 0 0 0-3.5Z',
        ],
    },
    user: {
        paths: [
            'M12 12c2.76 0 5-2.46 5-5.5S14.76 1 12 1 7 3.46 7 6.5 9.24 12 12 12Zm0 2c-4.42 0-8 2.24-8 5v2h16v-2c0-2.76-3.58-5-8-5Z',
        ],
    },
    logout: {
        paths: [
            'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4',
            'M16 17l5-5-5-5',
            'M21 12H9',
        ],
    },

    // Business
    package: {
        paths: [
            'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z',
            'M3.5 7.5 12 12l8.5-4.5',
            'M12 12v9.5',
        ],
    },
    truck: {
        paths: [
            'M1 3h15v13H1V3ZM16 8h4l3 3v5h-7V8Z',
            'M5.5 16a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM18.5 16a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z',
        ],
    },
    billing: {
        paths: [
            'M19 5H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Z',
            'M3 10h18',
            'M7 15h4',
        ],
    },
    contract: {
        paths: [
            'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z',
            'M14 2v6h6M16 13H8M16 17H8M10 9H8',
        ],
    },
    clock: {
        paths: [
            'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 6a1 1 0 0 1 1 1v3.6l2.2 1.3a1 1 0 0 1-1 1.7l-2.7-1.6A1 1 0 0 1 11 13V9a1 1 0 0 1 1-1Z',
        ],
    },
    route: {
        paths: [
            'M5 7h9a4 4 0 0 1 0 8H10',
            'M8 9 5 7l3-2',
            'M19 17H10a4 4 0 0 1 0-8h4',
            'M16 19l3-2-3-2',
        ],
    },
}
