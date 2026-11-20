// // // Concurrent request deduplication (Single-Flight)
// // // In the previous phase, we introduced a promise queue to protect cache mutations from interleaving. Now we're solving a different problem.

// // // The queue protects the cache from conflicting operations, but it doesn't prevent duplicate network requests.

// // // Imagine 10 components request the same image at almost the same time. All 10 requests see a cache miss and all 10 start their own network fetch.

// // // We want them to share one request instead.

// // // This pattern is called Single-Flight (also known as in-flight request deduplication)

// // // when 10 request arrives simultaneously
// // 10 requests → 10 network fetches

// // All of them can perform the same sequence:
// // Request 1 → Cache miss → fetch()
// // Request 2 → Cache miss → fetch()
// // Request 3 → Cache miss → fetch()
// // ...
// // Request 10 → Cache miss → fetch()

// // Even though the first request is already fetching the resource, the other requests don't know about it.

// // This is called a cache stampede (or thundering herd) when many requests simultaneously attempt to retrieve the same missing or expired resource.

// // Consequences include:
// // - Unnecessary network traffic.
// // - Higher server load.
// // - Duplicate processing.
// // - Increased bandwidth usage.
// // - Potential rate limiting.
// // - Multiple simultaneous cache writes for the same URL.
// // A cache alone cannot prevent this because the response isn't cached until the network operation completes.

// We already have two types of state in our system:
// State	Where it exists	Meaning
// Cached state	Cache Storage	A response has already been stored
// In-flight state	Memory	A request is currently being processed


// These are fundamentally different.

// A cached response is persistent browser storage. An in-flight request is temporary coordination state.

// The lifecycle of one resource

// Cache miss

// profile.webp doesn't exist

// In-flight

// profile.webp is being fetched

// Cached

// profile.webp response is stored

// During the in-flight stage, new requests should join the existing work instead of starting another network request.

// This means we need somewhere to store promises that have not yet settled.

// MAP  why map we need a relationship between a resource identity and its active promise.
// Resource key             In-flight promise
// ------------------------------------------------
// /images/profile.webp  →  Promise<Response>
// /images/logo.svg      →  Promise<Response>
// /styles/main.css     →  Promise<Response>

// When a new request arrives, we check this map.
// - If a promise already exists, join it.
// - If not, create a new promise and register it.
// - When the operation finishes, remove it from the map.
// This map is not a cache. It only tracks work currently in progress.

const inflightRequests = new Map();

function createRequestKey(reuest){
  return `${request.method}:${request.url}`;
}

export async function fetchDeduplicated(request){
  if(request.method !== "GET"){
    return fetch(request);
  }

  const key = createRequestKey(request)

  // A request from the same resource is already running
  const existingRequest = inflightRequest.get(key);
  if(existingRequest){
    console.log("[Single Flight] Joining:", request.url);
    const response = await existingRequest;

    //each caller  needs its own response body.
    return response.clone();
  }

  console.log("[Single flight] Starting:", request.url);

  // Start exactly one fetch for this key.
  const requestPromise = fetch(request);
  inflightRequests.set(key, requestPromise);
  try{
    const response = await requestPromise;
    // the orignal response remains available for cloning
    return response.clone();
  } finally {
    // Remove only if the map still points to this exact promise
    if(inflightRequests.get(key) === requestPromise){
      inflightRequests.delete(key);
    }
  }
};

// Why does the map store a Promise instead of a Response?
// Because the response doesn't exist yet.

// At the moment we initiate the network operation, we only have a promise representing future work.
// const requestPromise = fetch(request);

// Conceptually, the map temporarily holds this:

// inflightRequests.set(
//   '/images/profile.webp',
//   Promise<Response>
// );

// When another request arrives, it retrieves that same promise and waits for its completion.
// Why do we clone the response?
// This is a critical detail.

// A Response has a body stream. A stream generally cannot be consumed multiple times once it has been read.

// Imagine ten callers receive the exact same Response object:
// const response = await sharedPromise;

// If one caller reads its body, another caller could encounter an already-consumed body.

// Instead, each caller receives a separate clone:
// return response.clone();

// The response stored in the in-flight map remains the shared source response. Each waiting caller gets a usable clone.

