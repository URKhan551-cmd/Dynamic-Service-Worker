// What happens when a user navigates to a page that has never been cached, while the device is offline?
// This phase connects the different parts of our service worker into a complete offline-navigation flow.

// Understand the problem before writing code
// Imagine your application has these pages:
// /
// ├── index.html
// ├── about.html
// ├── dashboard.html
// └── offline.html

// During installation, we precached:
// export const APP_SHELL_FILES = [
//   './',
//   './index.html',
//   './offline.html',
//   './styles.css',
//   './js/main.js',
// ];

// The user visits / while online.

// The browser downloads the page, and Network-First stores its response in Cache Storage.

// Later, the user visits:
// /dashboard.html

// But there is a problem:
// - The user has never visited this page.
// - The page was not precached.
// - The device is offline.
// - Network-First tries the network.
// - The network request fails.
// - Cache Storage has no /dashboard.html.
// What happens?
// Our current Network-First implementation throws the network error.
// The browser receives a failed navigation instead of a useful page.
// We already have offline.html, but our strategy does not know that it should use it.

// This is the missing piece.


// These are different decisions:
// - First, try to provide the requested resource.
// - If that is impossible during navigation, provide a generic offline experience.
// The offline page is not the requested dashboard. It is a fallback document explaining why the requested page cannot be displayed.

// This distinction is important when designing real applications.
// 3. Where should this fallback logic live?
// We have two possible approaches.

// Approach A: Put offline fallback inside networkFirst().
// But Network-First is a general strategy. It should not necessarily know that every request is a page navigation.
// Imagine we later use Network-First for an API request. Should it return an HTML offline page when the API fails?
// No. That would violate the API's expected response format.
// Approach B: Handle navigation-specific fallback in the router.
// This is a better separation of responsibilities.

// The router already knows whether a request is a navigation:
// request.mode === 'navigate'
// Therefore:
// - networkFirst() handles network-versus-cache behaviour.
// - router.js handles navigation-specific offline fallback.
// This keeps the strategy reusable.

// Our implementation will follow Approach B.

import {staticCache} from "./config.js";

export async function handleNavigation(request){
   try{
     // first we use our network first strategy
     const {networkFirst} = await import('./strategiesNetworkFirst.js');
     
     return await networkFirst(request);
   } catch (error){
     console.warn('[Navigation Fallback] Navigation failed.', request.url, error);
     // request page could not be provided
     // try the precached offline document
     const cache = await caches.open(staticCache);

     const offlinePage = await cache.match(new URL('./offline.html', self.location.origin).href);

     if(offlinePage){
       console.log('[Navigation Fallback] Returning offline.html');
       return offlinePage;
     }

     // no fallBack document is available
      return new Response('You are offline and the fallback page is unavailable.', {
        status: 503,
        statusText: 'Service Unavailable',
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
        },
      });
        
     
   }
  
}


// why use an absolute URL for the cache lookup
// our app might be accesssed through a URL such as :  https://example.github.dev/
// the relative oath  ./offline.html depends on its resolution context
// by constructing an absolute URL using service Worker origin we make the intended cache key explicit.
// new URL('./offline.html', self.location.origin).href
// this resolve to   https://example.github.dev/offline.html
// this is the URL we want to retrieve fromthe cache storage.


// Why return the offline page with its original status?
// The offline page was precached as a normal HTML response, usually with status 200.
// Returning that response means the browser receives a successful HTML document, even though it represents a fallback.
// This is a common trade-off: the browser can display the offline page normally, but the navigation response does not communicate an HTTP failure status.
// For our learning project, this is acceptable. We will discuss status semantics and more advanced navigation handling later.

