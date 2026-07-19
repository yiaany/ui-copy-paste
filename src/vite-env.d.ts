/// <reference types="vite/client" />

// CRXJS: импорт content-скрипта с суффиксом `?script` возвращает
// extension-relative путь к собранному бандлу (для chrome.scripting.executeScript).
declare module '*?script' {
  const src: string;
  export default src;
}

// Аналогичный вариант для IIFE-бандлов (понадобится для инъекции в MAIN-мир).
declare module '*?script&module' {
  const src: string;
  export default src;
}
