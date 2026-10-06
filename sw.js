// in our project when api get call with fetch browser listen to it.
self.addEventListener("fetch", (event) => {
    // now how to work with request further
    console.log("Request hit", event.request.url);

  event.respondWith(
    fetch(event.request)
  )
})