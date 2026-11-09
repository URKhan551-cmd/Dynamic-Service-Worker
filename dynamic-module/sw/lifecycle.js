import {staticCache, appShellFiles } from "./config.js";

export function onInstall(event){
    console.log("Service worker install event started");

    event.waitUntil( (async () => {
        // 1 open or create static cache.
        const cache  = await caches.open(staticCache);  // browser opened the cache named (dynamic-sw-lab-v1)
                    // if it doesnot exist browser will create. it it exists open existing one. 
        console.log('[Service Worker ] cache opened:', staticCache);

        // 2 fetch and store all aplication shell resources.
        await cache.addAll(appShellFiles); // browser fetches ecah resource and stores the corresponding responses.
        console.log("[ServiceWorker] application shell cached");
    })()
);
}
// GET ./index.html -> Receive HTTP res  -> store req + res in cache storage.
// event.waitUntil() is still alive until the entire async operation settles; if one resource fails to download addAll() rejects. installation fails


// why we need activate lifecycle
// i initially have (dynamic-sw-lab-v1)  -->> later i release another version (dynamic-sw-lab-v2);
// if i dont clean up old caches my browser may accumulate outdated application.
// we need cleanup mechanism
export function onActivate(event){
    console.log("Service Worker Activation event start..");

    event.waitUntil((async () => {
        // get every cache name.
        const cacheNames = await caches.keys();

        // 2 identify outdated cache belonging to our app
        const outdatedCaches = cacheName.filter(cacheName => {
            return (
                cacheName.startsWith(cachePrefix) && cacheName !== staticCache
            );
        });

        // 3 delete outdated caches.
        await Promise.all(  // suppose i have (dynamic-sw-lab-v0)(dynamic-sw-lab-old)(dynamic-sw-lab-test) each caches.delete() return a promise
            outdatedCaches.map(cacheName => {   // we delete them concurrently and wait until all deletion complete.
                console.log("[service worker] Removing:", cacheName);
                return caches.delete(cacheName);
            })
        )
        console.log("Service Worker activation completed");
    })()
)
}


