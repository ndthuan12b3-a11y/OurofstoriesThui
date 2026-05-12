// Shim to prevent libraries from overwriting the read-only window.fetch
// It returns the native fetch if available, otherwise undefined.
const nativeFetch = typeof globalThis !== 'undefined' ? globalThis.fetch : (typeof fetch !== 'undefined' ? fetch : undefined);

export { nativeFetch as fetch };
export default nativeFetch;
