// We need to maintain that information ourselves if we want reliable expiration based on when our application cached a resource.
// 4. Why metadata is a separate concern
// Suppose we store this image:
// /images/product-1.webp

// We need to know when it entered the cache.

// We could try to infer that from the HTTP Date header, but that header describes the response's HTTP date, not necessarily the time our service worker stored it.

// For expiration, we need our own timestamp.

// Conceptually, our metadata looks like:
// {
//   url: 'https://example.com/images/product-1.webp',
//   cachedAt: 1794570000000
// }


// The timestamp is Unix time in milliseconds.

// When we later inspect the entry:
// const age = Date.now() - cachedAt;


// If the age exceeds our maximum allowed age, the resource is expired.

// This distinction is important:
// - Date.now() tells us the current time.
// - cachedAt tells us when our application stored the entry.
// - maxAgeSeconds defines how old an entry may become.
// The expiration condition is:
// \[
// \text{ageSeconds} =
// \frac{\text{Date.now()}-\text{cachedAt}}{1000}
// \]

// An entry is expired when:
// \[
// \text{ageSeconds} > \text{maxAgeSeconds}
// \]

// 5. Build a cache manager
// We should not put all cache-management operations inside cacheFirst.js or networkFirst.js.

// Those modules implement retrieval policies. A cache manager should handle storage operations and retention.

// ,
// } = RUNTIME_CACHE_LIMITS;


import {
  RUNTIME_CACHE,
  RUNTIME_METADATA_CACHE,
  RUNTIME_CACHE_LIMITS,
} from '../config.js';

import { runExclusive } from '../utils/operationQueue.js';

const {
  maxEntries,
  maxAgeSeconds,
} = RUNTIME_CACHE_LIMITS;

// Create a separate metadata key for each resource URL.
// Creates a synthetic Request that acts as a key in the metadata cache.
// You need a deterministic 1-to-1 mapping from resource URL -> metadata entry. You can't use the original request directly as key in the metadata cache because you'd collide with the real cache. So you create a fake URL like https://yourapp.com/**sw_metadata**?url=https://yourapp.com/api/user
// This turns any resource URL into a unique metadata key. Using Request object as key is required by Cache API - cache.match() expects a Request.
function createMetadataKey(request) {
  const metadataURL = new URL(
    '/__sw_metadata__',
    self.location.origin
  );

  metadataURL.searchParams.set('url', request.url);

  return new Request(metadataURL.href);
}

// Internal function: must only be called while holding the queue.
// This is the core read logic. The Unsafe suffix means: not thread-safe, must be called inside runExclusive.
// caches.open both caches
// runtimeCache.match(request) - try to find response
// If not found -> undefined (cache miss)
// metadataCache.match(metadataKey) - find its timestamp
// If response exists but metadata doesn't: Delete the response. This is self-healing. A response without metadata cannot be trusted - you don't know its age. Could be from an old version of code or a partial write.
// Parse metadata JSON, get cachedAt
// Validate cachedAt:
// !Number.isFinite or <=0 or > now -> invalid. Future timestamp means clock skew or corrupted data. Treat as invalid, delete both.
// Calculate ageSeconds = (now - cachedAt)/1000
// If ageSeconds > maxAgeSeconds -> expired, delete both, return undefined
// Else return cachedResponse
async function getRuntimeResponseUnsafe(request) {
  const runtimeCache = await caches.open(RUNTIME_CACHE);
  const metadataCache = await caches.open(RUNTIME_METADATA_CACHE);

  const cachedResponse = await runtimeCache.match(request);

  if (!cachedResponse) {
    return undefined;
  }

  const metadataKey = createMetadataKey(request);
  const metadataResponse = await metadataCache.match(metadataKey);

  // A response without metadata cannot be trusted.
  if (!metadataResponse) {
    await runtimeCache.delete(request);

    console.warn(
      '[Cache Manager] Removed response without metadata:',
      request.url
    );

    return undefined;
  }

  let metadata;

  try {
    metadata = await metadataResponse.json();
  } catch (error) {
    metadata = null;
  }

  const cachedAt = metadata?.cachedAt;
  const now = Date.now();

  // Invalid metadata is treated as an invalid cache entry.
  if (
    !Number.isFinite(cachedAt) ||
    cachedAt <= 0 ||
    cachedAt > now
  ) {
    await Promise.all([
      runtimeCache.delete(request),
      metadataCache.delete(metadataKey),
    ]);

    console.warn(
      '[Cache Manager] Removed entry with invalid metadata:',
      request.url
    );

    return undefined;
  }

  const ageSeconds = (now - cachedAt) / 1000;

  if (ageSeconds > maxAgeSeconds) {
    await Promise.all([
      runtimeCache.delete(request),
      metadataCache.delete(metadataKey),
    ]);

    console.log(
      '[Cache Manager] Expired:',
      request.url
    );

    return undefined;
  }

  return cachedResponse;
}

// Public read operation.
// It is queued because an expiration check can delete cache entries.
// Why queued? Because inside getRuntimeResponseUnsafe you delete entries if they're expired or invalid. Delete is a write. If two fetch handlers call this at same time without a queue, you get:
// Thread A reads -> sees expired -> starts delete
// Thread B reads -> still sees old entry before A finishes delete -> returns stale data
// runExclusive makes the whole read-check-delete atomic.
export function getRuntimeResponse(request) {
  return runExclusive(() => {
    return getRuntimeResponseUnsafe(request);
  });
}

// Internal function: must only be called while holding the queue.
// FIFO eviction to prevent unbounded growth.
// Get all keys: runtimeCache.keys() - all requests in cache
// If length <= maxEntries -> do nothing
// For each request, fetch its metadata to get cachedAt. If metadata is broken, set cachedAt = 0 so it gets evicted first - oldest/broken first.
// Sort entries by cachedAt ascending - oldest first
// Calculate excessCount = entries.length - maxEntries
// Take slice(0, excessCount) - the oldest N
// Delete both response and metadata for each, using Promise.
// Promise.allSettled not all: If one delete fails (QuotaExceeded, etc.), you don't want to abort all evictions. You log failures and continue.
// Sorting by cachedAt gives FIFO, not LRU. This is simpler and cheaper than LRU which would require updating metadata on every read. FIFO is fine for runtime cache.
// Setting broken metadata to 0 is a smart trick - ensures corrupted entries are the first to be purged.
async function enforceRuntimeCacheLimitUnsafe() {
  const runtimeCache = await caches.open(RUNTIME_CACHE);
  const metadataCache = await caches.open(RUNTIME_METADATA_CACHE);

  const requests = await runtimeCache.keys();

  if (requests.length <= maxEntries) {
    return;
  }

  const entries = [];

  for (const request of requests) {
    const metadataKey = createMetadataKey(request);
    const metadataResponse = await metadataCache.match(metadataKey);

    let cachedAt = 0;

    if (metadataResponse) {
      try {
        const metadata = await metadataResponse.json();

        if (Number.isFinite(metadata?.cachedAt)) {
          cachedAt = metadata.cachedAt;
        }
      } catch (error) {
        console.warn(
          '[Cache Manager] Invalid metadata during eviction:',
          request.url
        );
      }
    }

    entries.push({
      request,
      metadataKey,
      cachedAt,
    });
  }

  // Oldest insertion time first: FIFO-style eviction.
  entries.sort((a, b) => a.cachedAt - b.cachedAt);

  const excessCount = entries.length - maxEntries;
  const entriesToDelete = entries.slice(0, excessCount);

  const deletionResults = await Promise.allSettled(
    entriesToDelete.map(async ({ request, metadataKey }) => {
      await Promise.all([
        runtimeCache.delete(request),
        metadataCache.delete(metadataKey),
      ]);
    })
  );

  const failures = deletionResults.filter(
    (result) => result.status === 'rejected'
  );

  if (failures.length > 0) {
    console.error(
      '[Cache Manager] Some eviction operations failed:',
      failures
    );
  }

  console.log(
    `[Cache Manager] Evicted ${entriesToDelete.length} entries.`
  );
}

// Public version for standalone use.
// Do not call this public wrapper from inside another queued operation.
// Public safe wrapper for the eviction. Again, needs to be exclusive because it reads keys() and deletes. Without a lock, you could have:
// Thread A gets keys -> length 101
// Thread B adds entry -> length 102
// Thread A evicts 1 entry based on stale count

// Queue prevents that.
// Also note the comment: Do not call this public wrapper from inside another queued operation. Because runExclusive inside runExclusive would deadlock.
export function enforceRuntimeCacheLimit() {
  return runExclusive(() => {
    return enforceRuntimeCacheLimitUnsafe();
  });
}

// Public write operation.
// Response, metadata, rollback and eviction share one critical section.
// Open both caches
// Save previous state: previousResponse and previousMetadata. This is for rollback.
// Try to write:
// runtimeCache.put(request, response.clone()) - you MUST clone because a Response body can only be read once. If you don't clone, the caller can't use it.
// metadataCache.put(metadataKey, new Response(JSON.stringify({cachedAt: Date.now()}))) - fresh timestamp
// If write fails (QuotaExceeded, storage full, etc.):
// Try to rollback to previous state
// If there was a previous response, put it back, else delete
// Same for metadata
// Use allSettled for rollback - even rollback can fail, log it but don't hide original error
// throw writeError - preserve original error so caller knows it failed
// If write succeeds:
// Call enforceRuntimeCacheLimitUnsafe() directly, NOT the public wrapper (to avoid deadlock). This is inside same queue, so eviction happens atomically with the put.
export function putRuntimeResponse(request, response) {
  return runExclusive(async () => {
    const runtimeCache = await caches.open(RUNTIME_CACHE);
    const metadataCache = await caches.open(RUNTIME_METADATA_CACHE);

    const metadataKey = createMetadataKey(request);

    // Preserve existing entries in case an overwrite partially fails.
    const previousResponse = await runtimeCache.match(request);
    const previousMetadata = await metadataCache.match(metadataKey);

    try {
      await runtimeCache.put(
        request,
        response.clone()
      );

      await metadataCache.put(
        metadataKey,
        new Response(
          JSON.stringify({
            cachedAt: Date.now(),
          }),
          {
            headers: {
              'Content-Type': 'application/json',
            },
          }
        )
      );
    } catch (writeError) {
      console.error(
        '[Cache Manager] Write failed. Attempting rollback:',
        writeError
      );

      // Restore the previous state as far as possible.
      const rollbackResults = await Promise.allSettled([
        previousResponse
          ? runtimeCache.put(request, previousResponse.clone())
          : runtimeCache.delete(request),

        previousMetadata
          ? metadataCache.put(metadataKey, previousMetadata.clone())
          : metadataCache.delete(metadataKey),
      ]);

      const rollbackFailures = rollbackResults.filter(
        (result) => result.status === 'rejected'
      );

      if (rollbackFailures.length > 0) {
        console.error(
          '[Cache Manager] Rollback was incomplete:',
          rollbackFailures
        );
      }

      // Preserve the original write error.
      throw writeError;
    }

    // Call the internal function, not its queued public wrapper.
    await enforceRuntimeCacheLimitUnsafe();
  });
}

// getRuntimeResponse() => retrieve a runtime entry only if it is still fresh
// putRuntimeResponse() =>  store a response and its timestamp
// enforceRunTimeCacheLimit() =>  Remove oldest entries when the cache exceds its limit.

// A. Why use a synthetic metadata key?
// We need a way to associate metadata with a particular cached request.
// We create a synthetic Request URL using the original URL as a query parameter:
// /__sw_metadata__?url=...
// The metadata is stored as a separate Response in a separate cache.
// This avoids modifying the actual network response.

// B. Why remove entries with missing metadata?
// Our policy says that an entry must have a verifiable timestamp to be served.
// If metadata is missing, we cannot establish its age. Removing it is a conservative choice.

// C. Why sort by cachedAt?

// We need a deterministic way to decide which entries to remove.
// The oldest timestamp comes first, so when the cache exceeds its limit, we remove the oldest stored entries.
// This is FIFO-style eviction: first in, first out.
// It is not true LRU (Least Recently Used). We'll examine that distinction shortly.


This is a mini database transaction pattern.

Atomicity: Put response + put metadata + eviction all happen in one queue. You never have a window where response exists without metadata.
Rollback: Most SW caches just do cache.put() and if it fails halfway, you end up with half-written state. Here they restore the previous good state.
Clone on read/write: response.clone() is mandatory in Cache API. Original response stream would be consumed otherwise.
Direct call to unsafe eviction: Shows deep understanding of the queue. Calling the public version would enqueue a second task inside the first task -> deadlock.

Code
read:  match -> check metadata -> validate age -> return or self-clean
write: save old -> put new + put metadata -> evict -> or rollback on failure
all operations: runExclusive queue to prevent race
