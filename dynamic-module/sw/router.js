export function handleFetch(event){
  const request = event.request;  // extract the browser req  diagnose intrumentation/ observe req before decide how to handle it .
  console.log("[Fetch Event]", {
    method: request.method,
    url: request.url,
    mode: request.mode,
  });

  event.respondWith(fetch(request)); // the SW IS NOW in control of the res even though it has not changed the res iitself.
  
}
