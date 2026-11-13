// We need policies that reflect the resource's requirements.
// The four caching strategies
// Cache-First
// (Cache → Network)
// Good for static resources where quick loading matters.

// Network-First
// (Network → Cache)
// Good when freshness matters but offline access is useful.

// Cache-Only
// (Cache only)
// Good for resources deliberately precached for offline use.
  
// Network-Only
// (Network only)
// Good when the application must obtain data from the server.

import { staticCache } from "./config.js";

export async function cacheOnly(request){
  //cached-only is intended for GET resources retrieval.
  if(request.method !== "GET"){
    return new Response('Cache only supports GET requests.', {status: 405});
  }

  const cache = await caches.open(staticCache);
  const cachedResponse = cache.match(request);

  if(cachedResponse){
    console.log('[Cached Only] Cache Hit:', request.url);
    retturn cachedResponse;
  }

  console.warn('[Cache Only] cache Miss: ', request.url);

  return new Response('this resource is not available offline.',
                      {
                        status: 504,
                        statusText: 'Offline Cache Miss',
                        headers: {'Content-Type': 'text/plain; charset=utf-8',},
                      }
                      );
  
};


// cache.match(request)

// Searches the selected cache for a matching request. It resolves to:
// - A Response if the resource exists.
// - undefined if no matching entry exists.
// Why return the cached response directly?
// The Cache API gives us a stored Response. We can return it to the browser without making a network request.

// Why don't we clone it here?
// We are not passing the same response to two consumers. We are returning it to the browser, so we don't need a second copy for cache.put().
// That is different from Cache-First and Network-First, where a network response may need to be both returned and stored.

