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
function createMetadataKey(request) {
  const metadataURL = new URL(
    '/__sw_metadata__',
    self.location.origin
  );

  metadataURL.searchParams.set('url', request.url);

  return new Request(metadataURL.href);
}

// Internal function: must only be called while holding the queue.
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
export function getRuntimeResponse(request) {
  return runExclusive(() => {
    return getRuntimeResponseUnsafe(request);
  });
}

// Internal function: must only be called while holding the queue.
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
export function enforceRuntimeCacheLimit() {
  return runExclusive(() => {
    return enforceRuntimeCacheLimitUnsafe();
  });
}

// Public write operation.
// Response, metadata, rollback and eviction share one critical section.
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

import {
  
}
