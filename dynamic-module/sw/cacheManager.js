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

import { runTimeCache, runTimeMetaDataCache, runTimeCacheLimits } from "./config.js";
const { maxEntries, maxAgeSeconds }  = runTimeCacheLimits;

function createMetaDataKey(request){
  return new Request(`${self.location.origin}/__sw_metadata__?url=${encodedURIComponent(request.url)}`);
}

export async function getRunTimeResponse(request){
  const runtimeCache = await caches.open(runTimeCache);
  const metaDataCache = await caches.open(runTimeMetaDataCache);

  const cachedResponse = await runtimeCache.match(request);

  if(!cachedResponse){
    return undefined;
  }

  const metaDataKey = createMetaDataKey(request);
  const metaDataResponse = await metaDataCache.match(metaDataKey);
  if(!metaDataResponse){
    //missing meta data mean we canot verify the entry age.
    // remove the entry rather than serving an undefined stale response.
    await runtimeCache.delete(request);
    return undefined;
  }

  const metadata = await metaDataResponse.json();

  const ageSeconds = (Date.now() - metadata.cachedAt) / 1000;

  if(ageSeconds > maxAgeSeconds){
    await runtimeCache.delete(request);
    await metaDataCache.delete(metaDataKey);

    console.log('[Cached Manger] Expired:', request.url);

    return undefined;
  }

  return cachedResponse;
};


export async function putRuntimeResponse(request, response){
  const runtimeCache = await caches.open(runTimeCache);
  const metaDataCache = await caches.open(runTimeMetaDataCache);

  const metaDataKey = createMetaDataKey(request);
  await runtimeCache.put(request, response.clone());

  await metaDataCache.put(metaDataKey, new Response(JSON.stringify({cachedAt: Date.now(),}), {
    headers: {
      "Content-Type": 'application/json',
    }
  }
  ));

  await enforceRunTimeCacheLimit();
};


export async function enforceRunTimeCacheLimit(){
  const runtimeCache = await caches.open(runTimeCache);
  const metaDataCache  = await caches.open(runTimeMetaDataCache);

  const requests = await runTimeCache.keys();

  if(requests.length <= maxEntries){
    return;
  }

  const entries = [];

  for(const request of requests){
    const metaDataKey = createMetaDataKey(request);
    const metaDataResponse = await metaDataCache.match(metaDataKey);

    let cachedAt 0;

    if(metaDataResponse){
      const metadata = await metaDataResponse.json();
      cachedAt = metadata.cachedAt;
    }

    entries.push({
      request,
      metaDataKey,
      cachedAt,
    });
  }

  // oldest entries first
  entries.sort((a, b) => a.cachedAt - b.cachedAt);
  const excessCount = entries.length - maxEntries;
  const entriesToDelete = entries.slice(0, excessCount);

  await Promise.all(
    entriesToDelete.map( async ({request, metaDataKey}) => {
      await Promise.all([runTimeCache.delete(request), metaDataCache.delete(metaDataKey),]);
    })
  );

  console.log(`[Cache Manager] Removed ${entriesToDelete.length} old entries.`);
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

