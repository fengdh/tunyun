'use strict';

;(function() {
// END OF CLOSED SCOPE

const fs = require('fs');
var saved;

function report(err) {
  err && console.trace(err);
}

exports.prospect = function($, options) {
  
  const DEFAULTS = { title: '执行参数',
                     start: 1,
                     pages: 100,
                    maxReq: 50,
                 blockSize: 5000,
                filePrefix: 'UIDS_',
                 fileStart: 0,
                 minShares: -1,
                   minFans: 32,
                    accept: null,
                  scanType: 'full', // or 'delta'
                  };
  
  options = $.extend(DEFAULTS, saved, options);

  var $loader = $('<div>'),
      page = options.start,
      max  = page + options.pages - 1,
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
      var fname = options.filePrefix + ('000' + fcnt++).slice(-4) + '.txt',
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

  function* users() {
    let more = true;
    while (more && page < max) {
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
    var jobs = [], from = page, to = Math.min(from + options.maxReq, max + 1);
    while (page < to) {
      jobs.push({url: 'http://m.panduoduo.net/u/vdisk/' + page++});
    }
    console.log(`准备爬取第${from}～${to - 1}页...`);
    jobs = jobs.map((j, i) => {
            var d = $.Deferred(), jqXHR = $.ajax(j);
            jqXHR.then(
              (html) => d.resolve(parse(html) === 0 ? jobs.slice(i + 1).forEach(j => j.xhr.abort()) && !console.log(`abort page after ${from + i}`) : false),
              (xhr, msg, err) => d.resolve(true) && !console.log(`${err}: at page ${from + i}`));
            return d.promise({xhr: jqXHR});
          });
    
    return $.when.apply(null, jobs).then((...results) => !results.some(d => d));
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
  
  return chain(users());
}
  

// END OF CLOSED SCOPE
})();
