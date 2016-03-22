'use strict';

;(function() {
// END OF CLOSED SCOPE

const fs = require('fs'), gadget = require('../ryn.gadget.js');
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
                 minShares: 50,
                   minFans: 64,
                    accept: null,
                     retry: 3,
                  scanType: 'full', // or 'delta'
                  };
  
  options = $.extend(DEFAULTS, saved, options);

  var $loader = $('<div>'),
      page = options.start,
      max  = options.pages > 0 ? page + options.pages : -1,
      arr = [], 
      cnt = 0, fcnt = 0,
      accept = options.accept,
      marker = {},
      parsePage;
    
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

      console.info('保存至文件: ', fname, '\t 含用户数: ', arr.length);
      cnt += arr.length;
      arr = [];
      fs.writeFile(fname, content, report);
    }
  }
  
  function parseItem(index, e) {
    let $e = $(e), $a = $e.children('a'), $d = $e.find('.list-content > b'),
        item = { uid: +$a.attr('href').slice(9), 
                name:  $a.attr('title').slice(0, -3),
               share: +$d[0].innerText || 0, 
              follow: +$d[1].innerText || 0, 
                 fan: +$d[2].innerText || 0 };
    accept(item) && arr.push(item);
    return item;
  }
  
  function parseOtherPage(content) {
    return $(content).find('li > .content').each(parseItem).length;
  }
  
  function parseFirstPage(content) {
    parsePage = parseOtherPage;
    return $(content).find('li > .content').each(function(index, e) {
          let item = parseItem(index, e);
          if (index === 0) { marker.head = item.uid }
    }).length;
  }

  parsePage = page === 1 ? parseFirstPage : parseOtherPage;
  
  function whenDone() {
    check(true);
    console.info('第一步完成：搜集微博分享用户ID，共' + cnt + '件，保存在' + fcnt + '个文件中。');
    options.start = page;
    options.fileStart = fcnt;
    saved = options;
  }
  
  var pool = gadget.createPromisePool(options.maxReq, 5);
  var req = {}, failed = [], from = page, stop;
  var progress = {count: 0, done: 0}, allDone = $.Deferred();
  
  function checkAllDone() {
    process.nextTick(() => {
      if (allDone && stop && failed.length === 0
                  && progress.count > 0 && progress.count === progress.done) {
          allDone.resolve();
          allDone = null;
      }
    });
  }
  
  function abortPageAfter(no) {
    for (let k in req) {
      if (+k > no) {
        console.info(`abort page #${k}, after page #${no}`);
        req[k].cancel();
        if (req[k].xhr) {
          req[k].xhr.abort();
        } else {
          progress.done++;
        }
        delete req[k];
      }
    }
  }
  
  function retry() {
    while (failed.length > 0) {
      let r = failed.shift();
      if (r.retry++ < options.retry) {
        pool.run(r);
      } else {
        console.error(`Failed after retrying ${options.retry} times to load page #${r.key}`);
        stop = true;
        checkAllDone();
      }
    }
  }
  
    
  function more(free) {
    if (stop || free > 0) {
      retry();
    }
    
    if (!stop && free > 0) {
      console.info('add more: ', free);
      let to = page + free;
      if (max > 0) { to = Math.min(to, max) }
      while (page < to && !stop) {
        let key = page + '',
            args = {url: 'http://m.panduoduo.net/u/vdisk/' + page++};
// DELETE ME!
//if (page % 13 === 3)
//    args = {url: 'http://m.panduoduo.net/u-vdisk/' + key};

        pool.run(req[key] = () => { 
              let xhr = req[key].xhr = $.ajax(args);
              xhr.then(
                (html) => {
                      delete req[key];
                      if (!stop) {
                        if (parsePage(html) === 0) {
                          stop = true;
                          abortPageAfter(key);
                        } else {
                          check();
                        }
                      }        
                    },
                (xhr, msg, err) => {
                      console.warn(key, msg);
                      if (err !== 'abort') {
                        let r = req[key];
                        r.key = key;
                        r.retry = (r.retry || 0)
                        delete r.xhr;
                        failed.push(r);
                      }
                      delete req[key];
                    }
              ).always(() => {progress.done++; checkAllDone()});
            return xhr;
          });
      }
      if (max > 0 && page >= max) { stop = true };
    }
  }
  
  $.ajaxSetup({cache: false});
  pool.on('expect-more', more);
  pool.on('will-makePromise', () => progress.count++);
  pool.emit('expect-more', options.maxReq);
  
  allDone.then(whenDone);
}

module.exports = {
  scan: scan
}

// END OF CLOSED SCOPE
})();