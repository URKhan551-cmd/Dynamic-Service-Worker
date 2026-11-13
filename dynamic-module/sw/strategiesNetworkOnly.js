// Network-Only: when the cache must not participate
// Now consider an API endpoint:
// /api/account/balance

// Suppose the server returns:
// {
//   "balance": 1200,
//   "currency": "AED"
// }

// The user expects the current balance.

// If the service worker returns a response cached yesterday, the application might display incorrect financial information.

// For this endpoint, we want the service worker to use the network every time.

// The flow is straightforward:
// Receive request
//       |
//       v
// Call fetch(request)
//       |
//       +---- Success ----> Return network response
//       |
//       +---- Failure ----> Propagate network error

// No Cache Storage lookup. No cache write. No offline fallback.

// Important: Network-Only does not mean that the request is guaranteed to succeed. 
// It means we do not substitute a cached response when the network fails.

export async function networkOnly(request){
  console.log("[Network Only] :", request.url);
  return fetch(request);
}

// responsibility delibrately narrow. send request to the network and returun the result resposne 
// an HTTP 404 or 500 normally resolve to a response 
// A nettwork failure generally rejects the fetch promise.
// Network-Only allows either result to propagate to the caller.

