// Situation A — Network failure
// The user disconnects from the internet.
// const response = await fetch('/api/profile');

// The Promise rejects, usually with a TypeError.

// There is no usable HTTP response.

// Situation B — HTTP error

// The server is reachable, but the requested resource doesn't exist.
// HTTP/1.1 404 Not Found

// In this situation:
// const response = await fetch('/missing-page');

// console.log(response.status); // 404
// console.log(response.ok);     // false

// The Promise resolves to a Response object.

// This distinction is fundamental to Network-First.
// Situation	fetch() behavior	What should our strategy do?
// Internet unavailable	Promise rejects	Try cache
// Server connection refused	Promise rejects	Try cache
// HTTP 404	Promise resolves	Return 404
// HTTP 500	Promise resolves	Return 500
// HTTP 200	Promise resolves	Cache and return response

// Why return HTTP 500 instead of silently returning yesterday's cached data?

// Because the server successfully responded. A 500 is a real server-side error, not proof that the network is unavailable.
// An application might choose to serve stale data on certain server errors, but that is a separate policy decision. We shouldn't silently mix it into our basic Network-First strategy.
/*
import { staticCache } from "./config.js";
import { fetchWithTimeout } from "./timeoutNetworkReq.js";
const networkTimeout = 3000;

async function networkFirst(request){
  // 1: req = GET only cache.
  if(request.method !== "GET"){
    return fetch(request);
  }

  let networkResponse;
  
  // 2: open our Cache
  const cache = await caches.open(staticCache);

  try {
    // 3: try network fisrt
    const networkResponse = await fetch(request);

    // 4 : cache success http resposne.
    if(networkResponse.ok){
      await cache.put(request, networkResponse.clone());
      console.log("[Network Firrst] Updated Cache", request.url);
    }

    // 5: return network response
    return networkResponse;
  } catch (networkError){
    console.warn("[Network fisrt] Network Failed", request.url, networkError);

    // 6: network failed: try cache storage
    const cachedResponse = await cache.match(request);

    // 7: return cached response if available.
    if(cachedResponse){
      console.log('[Network First] Cache fallback:', request.url);
      return cachedResponse;
    }

    // 8: neither network nor cacche could provide a response.
    throw networkError;
  }
}

*/


// Decision A — Why open the cache before the try block?
// const cache = await caches.open(STATIC_CACHE);

// We need access to Cache Storage in both situations:
// - When the network succeeds, we store the new response.
// - When the network fails, we search for an older response.
// Opening the cache once and reusing the reference avoids repeating the same operation.

// There is also a subtle consequence: if opening the cache itself fails, the function rejects before entering the network try block. That is acceptable for this initial implementation, but later we can improve resilience by allowing a network request even when Cache Storage is unavailable.

// Decision B — Why is fetch() inside try?
// try {
//   const networkResponse = await fetch(request);
// }


// We need to catch network-level failures.

// Remember that await unwraps a Promise:
// - Fulfilled Promise → gives us the Response.
// - Rejected Promise → throws an error at the await expression.
// This means the catch block handles a rejected network operation.

// Decision C — Why cache only networkResponse.ok?
// if (networkResponse.ok) {
//   await cache.put(request, networkResponse.clone());
// }
// We don't want a failed HTTP response to replace a previously successful cached response.

// Imagine:
// 1. Yesterday, the server returned HTTP 200.
// 2. We cached that response.
// 3. Today, the server returns HTTP 500.
// 4. The new response is not cached.
// 5. The old cached response remains available.

// Decision D — Why throw the error?
// throw networkError;
// Suppose:
// - Network unavailable.
// - Cache miss.
// - No response available.
// We cannot invent a successful response.

// Throwing allows the respondWith() Promise to reject, which the browser treats as a failed fetch.

// Later, we can decide whether to return an offline page or a custom JSON error instead.

// But how does the Service Worker decide which strategy to use?
// That's the router's responsibility.

const networkTimeout = 3000;

export async function networkFirst(request){
  if(request.method !== "GET"){
    return fetch(request);
  }

  let networkResponse;

  // step 1: try the network with a time limit.
  try{
    networkResponse = await fetchWithTimeout(request, networkTimeout);
  } catch (networkError){
    console.warn('[Network Fisrt] network failed or timed out:', request.url, networkError);

    // step 2: network failed try cached storage
    const cache = await caches.open(staticCache);

    const cachedResponse = await cache.match(request);
    if(cachedResponse){
      console.log('[Network Fisrt] Cache fallback:', request.url);
      
      return cachedResponse;
    }

    // step3: neither network nor cache could help.
    throw networkError;
  }

// step 4: network succed cache succesful response.
  if(networkResponse.ok){
    try{
      const cache = await caches.open(staticCache);

      await cache.put(request, networkResponse.clone());

      console.log('[Network FIsrt] cache updated successs.', request.url);
      
    } catch (cacheError){
      console.warn('[Network First] cache update failed:', cacheError);
    }
  }

  // step5 : return the network response;
  return networkResponse;
}
