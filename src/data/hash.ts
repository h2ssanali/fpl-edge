/** Query parameters after the route in the hash, e.g. #/compare?a=1&b=2. */
export function hashParams(): URLSearchParams {
  return new URLSearchParams(window.location.hash.split('?')[1] ?? '');
}

/** The id at the end of a route such as #/player/123. */
export function hashId(): number {
  return Number(window.location.hash.replace(/\?.*$/, '').split('/').pop()) || 0;
}
