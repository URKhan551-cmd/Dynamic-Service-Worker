// we should not hardcode cache names in multiple files.

export const cachePrefix = "dynamic-sw-lab";
export const cacheVersion = "v3";
export const staticCache = `${cachePrefix}-static-${cacheVersion}`;
export const runTimeCache = `${cachePrefix}-runtime-${cacheVersion}`;
// Responses discovered while the application runs.
// Images · other eligible resources · runtime navigation responses
export const runTimeMetaDataCache = `${cachePrefix}-metadata-${cacheVersion}`;
// Metadata cache
// Information about runtime entries, such as when each was stored.
// Request URL → timestamp

export const appShellFiles = [
  "./",
  "./index.html",
  "./offline.html",
  "./styles.css",
  "./js/main.js",
];

export const runTimeCacheLimits = {
  maxEntries: 100,
  maxAgeSeconds: 7 * 24 * 60 * 60,
};


// imagine six months later we have 
// static application files
// API response cache.
// image cache
// font cache

// i dont want every module independently deciding cache name and version 
// configuration becomes a single source of truth.
/// when we release a new cache we change v1 to v2


// Why change v2 to v3?
// Our cache version identifies a particular generation of the application shell.

// We have changed the resources that should be installed into that cache. Incrementing the version creates a new cache:
// dynamic-sw-lab-v2
// dynamic-sw-lab-v3
// During activation, our existing cleanup code deletes older caches that start with dynamic-sw-lab but aren't the current cache.

// This means the new worker installs the updated app shell into v3, and the old cache is cleaned up when the new worker activates.
// One consequence: if installation fails because a file is missing or unavailable, the new worker's installation fails. Make sure offline.html actually exists at the project root.

// Service Worker Router

// Selects one strategy based on the request.
// Navigation (Network-First)

// Script / CSS / Image / Font (Cache-First)

// /offline.html (Cache-Only)

// /api/* (Network-Only)

// Selected strategy returns a Response

// This separation is an important architectural principle:
// - The router decides which policy applies.
// - The strategy implements how that policy works.
// - The cache layer manages stored responses.
// - The lifecycle module manages installation and activation.
// Each module has a distinct responsibility.

