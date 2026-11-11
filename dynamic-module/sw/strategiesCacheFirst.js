// *******************
// const cachedResponse = await cache.match(request);


// This operation searches a particular Cache object for a matching request.

// There are three important concepts to distinguish:
// Outcome	Meaning
// Cache hit	A matching response was found
// Cache miss	No matching response was found
// Cache operation failure	The cache lookup itself failed

// On a cache miss, cache.match() resolves to undefined.

// const cachedResponse = await cache.match(request);

// if (cachedResponse) {
//   return cachedResponse;
// }


// Why do we check?

// Because returning undefined from a fetch handler is not a valid HTTP response.

// The Service Worker must ultimately provide a valid Response object or a Promise that resolves to one.
// 3. Understand why we need Response.clone()
// This is one of the most important concepts in browser caching.

// Consider:
// const response = await fetch(request);

// await cache.put(request, response);

// return response;


// At first glance, this looks correct.

// But there is a problem: Response bodies are streams.

// A response body is generally consumable only once. When its stream is consumed, it becomes unusable for another read.

// For example:
// const response = await fetch('/data.json');

// const data = await response.json();

// // The response body has now been consumed.


// The browser cannot simply read the same body again as if it were a fresh stream.

// In our caching algorithm, we have two consumers:
// 1. Cache Storage needs the response body to store it.
// 2. The browser needs the response body to deliver it to the page.
// We need two usable copies.

// That's why the Fetch API provides:
// response.clone();


// Think of it conceptually like this:
// The two responses have separate body streams that can be consumed independently. The underlying implementation can share stream data internally, so cloning isn't necessarily a cheap copy of all the bytes.

// Our code will therefore use:
// await cache.put(request, response.clone());

// return response;
// The cache consumes the clone; the browser receives the original.

import {staticCache} from "./config.js";

export async function cacheFirst(request){
  // 1: only cache GET req
  if(request.method !== "GET"){
    return fetch(request);
  }

  // 2: open our app cache
  const cache = await caches.open(staticCache);

  // 3: look for an existing cache response
  const cachedResponse = await catch.match(request);

  // 4: return immmediate cache hit.
  if(cachedResponse){
    console.log('[Cached First] Cache Hit:', request.url);
    return cachedResponse;
  }

  console.log("[Cached First]: Ccahe miss:", request.url);
// 5: retrieve network response
  const networkResponse = await fetch(request);

  // 6: cache only succeful response 
  if(networkResponse.ok){
    await cache.put(request, networkResponse.clone());
    console.log('[Cache first] cached:', request.url);
  }

  // 7: return original response to the browser
  return networkResponse;
};


// fetch() normally resolves even if the server responds with HTTP 404 or 500.
// For example:
// const response = await fetch('/missing-page.html');

// console.log(response.status); // 404
// console.log(response.ok);     // false
// A 404 is a valid HTTP response but itis not successful repsonse.
// Decision C — Why await cache.put()?
// await cache.put(request, networkResponse.clone());
// We wait for the cache operation to finish before returning the response.
// This makes the strategy straightforward: when the request completes successfully, the cache write has also completed.
// There is a performance trade-off here: the browser waits for the cache write too. Later, we can explore response delivery and background cache updates as separate operations.


// now we created the flow of algorithm but not yet connected it will be connected through router.js

