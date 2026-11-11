// we should not hardcode cache names in multiple files.

export const cachePrefix = "dynamic-sw-lab";
export const cacheVersion = "v2";
export const staticCache = `${cachePrefix}-${cacheVersion}`;

export const appShellFiles = [
  "./",
  "./index.html",
  "./styles.css",
  "./js/main.js",
];

// imagine six months later we have 
// static application files
// API response cache.
// image cache
// font cache

// i dont want every module independently deciding cache name and version 
// configuration becomes a single source of truth.
/// when we release a new cache we change v1 to v2


