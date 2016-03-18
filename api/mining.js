'use strict';

;(function() {
// END OF CLOSED SCOPE

const fs = require('fs');
var saved;

function report(err) {
  err && console.trace(err);
}

function scan($, options) {
  
  const DEFAULTS = { title: '执行参数',
                     start: 1,
                     pages: -1,
                    maxReq: 50,
                 blockSize: 5000,
                filePrefix: 'ore_',
                 fileStart: 0,
                 minShares: -1,
                   minFans: 32,
                    accept: null,
                     retry: 3,
                  scanType: 'full', // or 'delta'
                  };
  
  options = $.extend(DEFAULTS, saved, options);

  var $loader = $('<div>'),
      page = options.start,
      max  = options.pages > 0 ? page + options.pages - 1 : -1,
      list = [], arr = [], 
      cnt = 0, fcnt = 0,
      accept = options.accept;
  
  if (!accept) {
    if (options.minShares < 0) {
      accept = item => item.fan >= options.minFans || (item.share === 0 && /^u[0-9]+$/.test(item.name));
    } else {
      accept = item => item.fan >= options.minFans || item.share >= options.minShares || (item.share === 0 && /^u[0-9]+$/.test(item.name));
    }
  }
  
  function check(done) {
    if (arr.length >= options.blockSize || done) {
      var fname = options.filePrefix + ('00000000' + fcnt++).slice(-8) + '.txt',
          content = JSON.stringify(arr.map(v => v.uid));

      console.log('保存至文件: ', fname, '\t 含用户数: ', arr.length);
      arr = [];
      cnt += arr.length;
      fs.writeFile(fname, content, report);
    }
  }

  function parse(content) {
    return $(content).find('li > .content').each(function() {
      var $e = $(this), $t = $e.children('a'), $d = $e.find('.list-content > b'),
          item = {
               uid: +$t.attr('href').slice(9), 
              name: $t.attr('title').slice(0, -3),
             share: +$d[0].innerText || 0, 
            follow: +$d[1].innerText || 0, 
               fan: +$d[2].innerText || 0 };

          accept(item) && list.push(item);
    }).length;
  }

  function* loop() {
    let more = true;
    while (more && (page < max || max < 0)) {
      more = yield go();
      console.log('more?', more);
    }
    whenDone();
  }
  
  function whenDone() {
    console.log('第一步完成：搜集微博分享用户ID，共' + cnt + '件，保存在' + fcnt + '个文件中。');
arr = list;
    check(true);
    options.start = page;
    options.fileStart = fcnt;
    saved = options;
  }
  
  
  $.ajaxSetup({cache: false});
  
  function go() {
    var req = [], jobs, failed = [], from = page, to = from + options.maxReq;
    to = max > 0 ? Math.min(to, max + 1) : to;
    while (page < to) {
      if (page % 13 === 3) {
        req.push({url: 'http://m.panduoduo.net/u/disk/' + page++ + 'abc'});
        continue;
      }
      req.push({url: 'http://m.panduoduo.net/u/vdisk/' + page++});
    }
    console.log(`准备爬取第${from}～${to - 1}页...`);
    jobs = req.map((j, i) => {
                var d = $.Deferred(), jqXHR; 
                jqXHR = $.ajax(j);
              jqXHR.then(
                (html) => d.resolve(parse(html) === 0 ? console.log(`abort page after ${from + i}`) | jobs.slice(i + 1).forEach(j => j.xhr.abort()) : false),
                (xhr, msg, err) => {
                      if (err !== 'abort') {
                        console.info('push failed req:', req[i])
                        failed.push(req[i]);
                        d.resolve(false);
                      } else {
                        console.log(`${err}: at page ${from + i}`);
                        d.resolve(true);
                      }
                });
                return d.promise({xhr: jqXHR});
              });
    
    return $.when.apply(null, jobs)
            .then((...results) => {
                if (failed.length > 0) {
                  console.warn('retry', failed);
                }
                return !results.some(d => d);
              });
    
  }
  
  // 有数量限定的执行令牌池，用来限定并发请求的数量避免负荷过大
  var pool = (function create_pool(size) {
    var used = 0, pending = [];
    
    function run(makePromise) {
      var wait = $.Deferred();
      used++ < size ? wait.resolve(used) : pending.push(wait);
      
      function free() {
        if (used > 0) {
          pending.length > 0 && pending.shift().resolve(used);
          used--;
        }
      }
      
      return wait.then(makePromise).then(promise => promise.always(free));
    }
    
    return run;    
  })(options.maxReq);
  
  // 封装$.ajax()调用，在并发执行的同时通过令牌池来限制请求符合，提高转存成功率
  function $ajax() {
    let args = [].slice(arguments);
    return pool(() => $.ajax.apply(null, args));
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
    
  return chain(loop());
}

module.exports = {
  scan: scan
}

// END OF CLOSED SCOPE
})();
