(($) => {
  
  const Emitter = require('events');

  // 有数量限定的执行令牌池，用来限定并发请求的数量避免负荷过大
  function createPromisePool(size, waitLen) {
    var used = 0, pending = [], emitter = new Emitter();
    waitLen = Math.max(0, waitLen || 0);

    function release() {
      let free = size - used + waitLen;
      if (used > 0) {
        pending.length > 0 && pending.shift().resolve(used) 
        used--;
        if (pending.length !== 0) { free = 0 } else { free++ }
      }
      process.nextTick(() => emitter.emit('expect-more', free));
      
      used == 0 && pending.length === 0 && emitter.emit('empty');
    }
      
    function run(makePromise) {
      var wait = $.Deferred();
      used++ < size ? wait.resolve(used) : pending.push(wait);
      
      makePromise.cancel = function() {
        let index = pending.indexOf(wait);
        if (index > -1) {
          console.error('canceled!')
          pending.splice(index, 1);
          wait.reject();
          used--;
          if (pending.length !== 0) { return }
        }
        process.nextTick(() => emitter.emit('expect-more', size - used + waitLen));
      }
      
      return wait.then(() => {
        emitter.emit('will-makePromise');
        let promise = makePromise();
        emitter.emit('after-makePromise');
        promise.always(release);
        return promise;
      });
    }

    emitter.run = run;
    return emitter;
  }

  function chain(gen, initial) {
    function run(input) {
      var output = gen.next(input);
      return output.done 
              ? $.Deferred().resolve(input) 
              : $.when(output.value).then(run, err => $.Deferred().reject(err));
    }

    return run(initial);
  }
  
  module.exports = {
                chain: chain,
    createPromisePool: createPromisePool
  }
})(jQuery);
