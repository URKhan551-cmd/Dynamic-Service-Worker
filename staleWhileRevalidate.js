async function staleWhileRevalidate(request){
    const cachedResponse = await caches.match(request);

    const networkPromise = fetch(request)
    .then(async response => {
        const cache = await caches.open("dynamic-2");

        await cache.put(
            request, 
            response.clone()
        );
        return response;
    });
    return cachedResponse || networkPromise;
}