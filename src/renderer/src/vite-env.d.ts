/// <reference types="vite/client" />

import type { BankAppApi } from "../../preload";

declare global {
  interface Window {
    bankApp: BankAppApi;
  }
}
