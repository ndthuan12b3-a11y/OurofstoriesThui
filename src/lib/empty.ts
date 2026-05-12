// This file shims problematic polyfills by returning native globals
const _FormData = typeof globalThis !== 'undefined' ? globalThis.FormData : undefined;
const _Blob = typeof globalThis !== 'undefined' ? globalThis.Blob : undefined;
const _File = typeof globalThis !== 'undefined' ? globalThis.File : undefined;

export { _FormData as FormData, _Blob as Blob, _File as File };
export default _FormData;
