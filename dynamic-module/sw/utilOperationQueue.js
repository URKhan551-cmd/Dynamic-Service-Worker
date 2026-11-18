// A cache lookup can itself modify shared state.

// For example, suppose A.webp is expired:
// 1. Request A reads its response and metadata.
// 2. Request B refreshes A.webp and writes a new timestamp.
// 3. Request A decides the entry is expired based on its earlier timestamp.
// 4. Request A deletes the newly refreshed response.
// This is a race condition between a read-and-delete operation and a write operation.

// Our design decision will be:

// All runtime-cache operations that can modify shared state, including expiration checks that delete entries, must participate in the same queue.

// For the first implementation, we'll also serialize runtime-cache lookups. This is simpler to reason about and gives us a consistent ordering. Later, we can optimize read concurrency without weakening correctness.

// Define the consistency rule
// We want these operations to behave as though they happened in a single ordered sequence:

// One shared operation queue

// Operation A — Read

// Read response → Read metadata → Check expiration → Return or delete

// Operation B — Refresh

// Write response → Write metadata → Enforce cache limit

// Operation C — Expiration cleanup

// Read current metadata → Delete expired entry and metadata

// Only one queued operation runs at a time. The order is determined by when operations are submitted.

// This gives us a useful property: if a refresh runs before an expiration check, the expiration check sees the refreshed metadata. If the expiration check runs first, it may delete the old entry, after which the refresh can write a new one.

//   // neither  operation can interept the other's critical section

  const queue = Promise.resolve();

export function runExclusive(operation){
   const result = queue.then(() => {
     return operation();
   });
  // reccover the queue regardless of this operation outcome.
  // the caller still receive the original result/rejection.
  queue = result.then( 
    () => undefined,
    () => undefined
  );

  return result;
  
}
// the important architectural decision is that every cache mutation and every expiration-driven
// deletion will use the same module instance.

