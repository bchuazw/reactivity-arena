/// <reference types="vite/client" />

declare module '*.css' {
  const content: string;
  export default content;
}

declare module '@rainbow-me/rainbowkit/styles.css';
declare module 'react-dom/client';

interface ImportMetaEnv {
  readonly VITE_GAME_SERVER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
