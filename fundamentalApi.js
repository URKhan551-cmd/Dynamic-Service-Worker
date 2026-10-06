// waitUntil()  API 
// respondWith()  API 


// waitUntil()  fundamental API event.waitUntil()

// suppose we wanna do some background work 

// event.waitUntil(
//     updateCache() 
// )   
// **  the event has happenned but do not consider this events asynchronous
// work finished yet.

self.addEventListener("fetch", event => {
    const request = event.request;

    event.respondWith(
        handleRequest()
    )

    event.waitUntil(
        updateSomething()
    )
    
})

// distinction 
respondWith()  // controls what response does the browser receive.

waitUntil() // controls what async work should remain associated with this event.
