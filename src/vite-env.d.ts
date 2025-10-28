/// <reference types="vite/client" />

// Ensure crypto.randomUUID() is available (native browser/Node API)
interface Crypto {
  randomUUID(): string;
}