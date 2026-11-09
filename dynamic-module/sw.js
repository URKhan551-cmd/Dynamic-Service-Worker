// this file is the entry of our worker.
// responsible for connect the lifecycle events to respective handlers.

import { onInstall, onActivate } from "./sw/lifecycle";
import {handleFetch } from "./sw/router.js";


// here self refers to global worker context not window context
// self does has browser apis  caches/fetch()/clients/self/URL
self.addEventListener("install", onInstall);


// browser dispatch an install event
// where we precache essential resources
// prepare initial app assets.
// perform installation related synchrounously operat

self.addEventListener("activate", onActivate);
// after successful instalation, browser determine
// when the new worker can activate.
// removes obsolte caches
// migrate old caches structure
// prepare new worker version


self.addEventListener("fetch", handleFetch); 
