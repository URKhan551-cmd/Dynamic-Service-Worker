import {cacheFisrt} from "./strategiesCacheFirst.js";
import {networkFirst} from "./strategiesNetworkFirst.js";
import {cacheOnly} from "./strategiesCacheOnly.js";
import { networkOnly } from "./strategiesNetworkOnly.js";


const cacheFirstDestination = new Set([
'script', "style", "image", "font",
]);



export function handleFetch(event){
  const request = event.request;  // extract the browser req  diagnose intrumentation/ observe req before decide how to handle it .
  const url = new URL(request.url);

  // let browser handle the non GET req normally.
if(request.method !== "GET"){
  return;
}

  // only handle resource form our own origin
  if(url.origin !== self.location.origin){
    return;
  }

// rule2: offline fallback page is cache only
  if(url.pathname === '/offline.html'){
    console.log('[Router] Cache Only:', request.url);
    event.respondWith(cacheOnly(request));
   return;
  }

  // rule 3: API requests are network only
  if(url.pathname.startsWith('./api/')){
    console.log('[Router] Network Only:', request.url);
    event.respondWith(networkOnly(request));
    return;
  }
  
  // HTML navigation : prefer network fisrt.
  if(request.mode === "navigate"){
    console.log('[Router] Network Fisrt:', request.url);
    event.respondWith(
      networkFirst(request);
    );
    
    return;
  }

  // static resources : prefer the cache.
  if(cacheFirstDestination.has(request.destination)){
    console.log('[Router] Cache First:', request.url);

    event.respondWith(
      cacheFirst(request)
    );

    return;
  }
   
}

// Why use request.mode === 'navigate'?
// Previously, we used:
// request.destination === 'document'

// For actual page navigation, request.mode === 'navigate' is a useful way to identify navigation requests.
// It distinguishes a navigation from other document-related requests.
// For example, when a user enters your website address or clicks a link to another page, the browser creates a navigation request.
// Our router now recognizes that navigation and selects Network-First.


// Why does the router return after respondWith()?
// if (request.mode === 'navigate') {
//   event.respondWith(networkFirst(request));
//   return;
// }

// The return prevents the same request from falling through into another routing condition.
// A request should be assigned one response strategy, not several competing strategies.
// This is an important routing invariant:
// One intercepted request should have one response owner.


// A note about the API rule: This is an example route convention. It assumes your API endpoints 
//   use the /api/ prefix. If you later use a separate API domain, 
//   this same-origin router will intentionally leave those requests alone.

