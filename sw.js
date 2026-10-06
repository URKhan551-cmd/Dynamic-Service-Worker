// in our project when api get call with fetch browser listen to it.

const CACHE_VAR = "dynamic-v2";

self.addEventListener("fetch", (event) => {
    // now how to work with request further
    console.log("Request hit", event.request.url);

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
        if(cachedResponse){
            return cachedResponse;
        }

        return fetch(event.request)
        .then(networkResponse => {
            return caches.open("dynamic-v2")
            .then(cache => {
                cache.put(
                    event.request, 
                    networkRequest.clone()
                );
               return networkResponse;
            });
        });
    })

   
  );
});



// the concept of uderstanding of response.clone() 
// if iireturn network response so there will be nothing left in cache but
// if i first clone it and keep it in cache by put() method  consumed the response body
// release a network response to browser. 

// imagine 
// browser request 
GET /
GET /app.js
GET /style.css
GET /logo.png 
GET /api/products // that would be kind of headache 
GET /api/users 
GET /api/orders 
GET /api/profile
POST /api/profile
PUT /api/order
DELETE/api/account
// should we cache all of them QQQQ
// Absoloutly noyt

// first operation rule inspect the **(request)

self.addEventListener("fetch", event => {
    const request = event.request;
    console.log({
        url: request.url,
        method: request.method,
        destination: request.destination,
    });
}
);

// now we can see GET POST PUT DELETE PATCH in methods

// and destination
document
script 
style 
image 
font 


// best way to code architecture
self.addEventListener("fecth", event => {
    const request = event.request;
    if(request.method !== "GET"){
       return;
    }

    event.respondWith(
        handleRequest(event.request)
    )
});

async function handleRequest(request){
    const cachedResponse = await caches.match(request);
    if(cachedResponse){
        return cachedResponse;
    }

    const response = await fetch(request);
    return response;
}