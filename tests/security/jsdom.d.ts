// jsdom ships without types and @types/jsdom is not a dependency; the security specs only parse markup.
declare module 'jsdom' {
  export class JSDOM {
    constructor(html?: string);
    readonly window: Window & typeof globalThis;
  }
}
