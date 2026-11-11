import {cacheFisrt} from "./strategiesCacheFirst.js";

const cacheableDestination = new Set([
  'document', 'script', "style", "image", "font",
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

  // ignore the req type we havent designed a strategy for.
  if(!cacheableDestination.has(request.destination)){
   return;
  }

  console.log("[Router] Cache First: ", request.url);
  
  // must be caled synchronously during event dispatch

  event.respondWith(cacheFisrt(request)); 
  
}
