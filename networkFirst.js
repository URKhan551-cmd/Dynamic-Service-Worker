async function networkFirst(request){
    try{
        const networkResponse = await fetch(request);
        const cache = await caches.open("dynamic-v2");
        await cache.put(
            request, 
            networkResponse.clone()
        );
       return networkResponse;

    } catch(error){
        const cachedResponse = await caches.match(request);
        if(cachedResponse){
            return cachedResponse;
        }
        throw error;
    }
}