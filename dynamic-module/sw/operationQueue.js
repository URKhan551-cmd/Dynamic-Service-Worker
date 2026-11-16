// the queue begin in fulfilled state. no previous operations to wait. immediately RUN.
let queue = Promise.resolve();

export function runExcluisve(operation){
// wait for prev operation 
  // execute new operation
  // store Promise in result.   operation return promise the promise chain adopt its fulfilled or rejected state.
  const result = queue.then(() => {
    return operation();
  });

  queue = result.then( // suppose an operation A fails we assign queue = result; queue becomes rejected. 
    () => undefined,    
    () => undefined
  );
// That means one failed operation can prevent all future queued operations from executing.
  return result; // why not return queue --> because the caller still needs to know whether its operation
  // succeeded or failed.
}

// result = Reports the outcome of this operation to its caller.
// queue = Ensure the next operation can execute.


// TEMPORRAY File.
import { runExclusive } from "./operationQueue.js";
// ms = mili seconds
function wait(ms){
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  })
};


async function operationA(){
  console.log("A started");
  await wait(1000);
  console.log("A finished");
};


async function operationB(){
  console.log("B started");
  await wait(500);
  console.log("B finished");
};

async function operationC(){
  console.log("C started");
  await wait(300);
  console.log("C finished");
};

const results = await Promise.all([
  runExclusive(operationA),
  runExclusive(operationB),
  runExclusive(operationC),
]);

console.log("All operstions completed:", results);

// Expected execution order:
// A started
// A finished
// B started
// B finished
// C started
// C finished
// All operations completed

// Although all three calls were submitted through Promise.all, their operations execute sequentially because the queue controls when each one starts.

// Promise.all does not itself serialize anything. The queue does.

// TRY FAILURE RECIVERY TOO : 
async function failingOperation(){
  console.log("Failure operation started");
  throw new Error("Simulate failure");
}

try {
  await runExclusive(failingOperation);
} catch (error){
  console.log("Caller received:", error.message);
}

await runExclusive(operationB);

// Expected behavior:
// Failure operation started
// Caller received: Simulated failure
// B started
// B finished

// The failed operation rejects for its caller, but the queue remains usable.
