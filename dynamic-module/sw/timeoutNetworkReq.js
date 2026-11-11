// 3. Understanding AbortController
// JavaScript provides an API called AbortController.

// Its purpose is to allow one part of your program to signal that an asynchronous operation should stop.

// Let's understand the relationship:

// AbortController

// Creates and owns the cancellation signal.

// controller.signal

// fetch(request, )

// Observes the signal while the request is running.

// controller.abort()

// Fetch is aborted

// Its Promise rejects with an abort-related error.

// Let's inspect a small example:

const controller = new AbortController(); // controller can cancel suported async operation.
const signal = controller.signal; // communication object pass to operation whether cancelation has been requested.
const requestPromise = await fetch("/api/data", {signal});
// ask the operation to stop
controller.abort(); // signals cancellation this cause the fetch promise to reject ifit has not already completed.

// with timeout delay
const controller = new AbortController();
const timeoutId = setTimeout(() => {
  controller.abort();
}, 3000);
const response = await fetch("/api/data", {
  signal: controller.signal,
});

// The logic is:
// 1. Create a controller.
// 2. Schedule a timer for 3,000 milliseconds.
// 3. Start the network request with the controller's signal.
// 4. If the timer fires before the request completes, call abort().
// 5. The fetch Promise rejects.
// But there is another engineering detail we must handle

// Why do we need clearTimeout()?
// Suppose the network responds after 200 ms.
// Our timer was scheduled for 3,000 ms. If we leave it running, it will still execute later.
// That means it will call abort() even though the request has already completed.
// It won't undo the completed response, but it is unnecessary work and poor resource management.
// We should clear the timer once the request settles.
// JavaScript's finally is useful here because it runs whether the operation succeeds or fails.

const controller = new AbortController();
const timeoutId = setTimeout(() => {
  controller.abort();
}, 3000);

try{
  const response = await fetch("/api/data", {
    signal: controller.signal,
  });
  return response;
} finally {
  clearTimeout(timeoutId);
};

// This is a pattern you will encounter frequently in backend development too:
// - Acquire a resource.
// - Perform an operation.
// - Release or clean up the resource in finally.

export async function fetchWithTimeout(request, timeoutMs){
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.warn(`Request Timeout after ${timeoutMs}ms:`, request.url);
    
    controller.abort();
  }, timeoutMs);

  try{
    const timeRequest = new Request(request, {
      signal: controller.signal,
    });

    return await fetch(timeRequest);
  } finally {
    clearTimeout(timeoutId);
  }
} 

// We need to attach a new cancellation signal without changing the original Request.

// The Request constructor can create a new Request based on an existing one:
// const timedRequest = new Request(request, {
//   signal: controller.signal,
// });

// The new request preserves the original request's relevant properties while using our cancellation signal.

// Our current Network-First strategy only handles GET request so we dont need to deal with 
// replaying a consumed req body here.

// Why does this function return await fetch(...)?
// The function returns a Promise that represents the fetch operation.

// Because we use await inside the try, if the fetch rejects, execution enters finally, clears the timer, and then the rejection propagates to the caller.

// The caller can handle that rejection

