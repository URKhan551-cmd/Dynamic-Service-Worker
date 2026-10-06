async function cacheFirst(request){
    const cachedResponse = await caches.match(request);
    if(cachedResponse){
        return cachedResponse;
    }

    const networkResponse = await fetch(request);
    const cache = await caches.open("dynamic-v2");
    const cloneResponse = networkResponse.clone();
    await cache.put(request, cloneResponse);

    return networkResponse;
}

self.addEventListener("fetch", event => {
    const request = event.request;
    if(request.method !== "GET"){
        return;
    }
    event.respondWith(
        cacheFirst(request)
    );
})