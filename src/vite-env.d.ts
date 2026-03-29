/// <reference types="vite/client" />

// Ensure crypto.randomUUID() is available (native browser/Node API)
interface Crypto {
    randomUUID(): string;
}

interface ImportMetaEnv {
    readonly VITE_MAPBOX_TOKEN?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
