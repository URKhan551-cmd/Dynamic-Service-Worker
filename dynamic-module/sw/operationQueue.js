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
