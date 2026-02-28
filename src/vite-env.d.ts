/// <reference types="vite/client" />

// Ensure crypto.randomUUID() is available (native browser/Node API)
interface Crypto {
    randomUUID(): string;
}

interface ImportMetaEnv {
    readonly VITE_GOOGLE_MAPS_API_KEY?: string;
    readonly VITE_GOOGLE_MAPS_MAP_ID?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
