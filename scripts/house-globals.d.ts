// The house-builder page (room-creator.html, loaded headless) hangs debug/QA/capture hooks off
// `window` for these scripts' page.evaluate() calls to reach — see house-builder.js and site.js.
// Declared both on Window (window.__x from Node-side code) and as bare globals (evaluate() callback
// bodies run IN the browser page, where tsc — type-checking them as written, with no idea they cross
// a page.evaluate() boundary — otherwise sees an undeclared identifier).
declare global {
  interface Window {
    __THREE?: any;
    __houseBuilderRef?: any;
    __houseComposerWarm?: (...args: any[]) => any;
    __houseDebug?: any;
    __houseExportCore?: (...args: any[]) => any;
    __housePropSheet?: any;
    __houseRenderBegin?: (...args: any[]) => any;
    __houseRenderEnd?: (...args: any[]) => any;
    __houseRenderFrames?: (...args: any[]) => any;
    __houseSceneQA?: ((...args: any[]) => any) & { register?: (code: string, fn: (ctx: any) => any) => void };
    __houseShotQA?: (...args: any[]) => any;
    __houseShotTrack?: (...args: any[]) => any;
    __houseVisibility?: any;
    __houseSupersample?: any;
  }
  var __THREE: any;
  var __houseBuilderRef: any;
  var __houseComposerWarm: (...args: any[]) => any;
  var __houseDebug: any;
  var __houseExportCore: (...args: any[]) => any;
  var __housePropSheet: any;
  var __houseRenderBegin: (...args: any[]) => any;
  var __houseRenderEnd: (...args: any[]) => any;
  var __houseRenderFrames: (...args: any[]) => any;
  var __houseSceneQA: ((...args: any[]) => any) & { register?: (code: string, fn: (ctx: any) => any) => void };
  var __houseShotQA: (...args: any[]) => any;
  var __houseShotTrack: (...args: any[]) => any;
  var __houseVisibility: any;
  var __houseSupersample: any;
}
export {};
