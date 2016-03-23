'use strict';

;(function() {
// END OF CLOSED SCOPE

const fs = require('fs'), gadget = require('../ryn.gadget.js'), ext = require('path').extname;
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
//      accept = options.accept,
      marker = {},
      isWeiboUser = (user) => user.share === 0 && user.name === `u${user.uid}`,
      parsePage,
      checkUser;

  
  var pool1 = gadget.createPromisePool(options.maxReq, 5);
  var pool2 = gadget.createPromisePool(options.maxReq, 5);
  var req = {}, failed = [], from = page, stop;
  var progress = {count: 0, done: 0}, allDone = $.Deferred();
  
  
// /^u[0-9]+$/.test(item.name)
    
//  if (!accept) {
//    if (options.minShares < 0) {
//      accept = user => user.fan >= options.minFans || isWeiboUser(user);
//    } else {
//      accept = user => user.fan >= options.minFans || user.share >= options.minShares || isWeiboUser(user);
//    }
//  }
  
  checkUser = (user) => {
    pool2.run( () => $.ajax({url: `http://m.panduoduo.net/u/vdisk-${user.uid}`}))
         .then((html) => { 
//                  console.log(JSON.stringify(parseShares(html),null, '\t')); 
                  user.detail = parseShare(html);
                  accept(user) && (arr.push(user), 
                                   console.log(arr.length));
                  check();
               },
               (xhr, msg, err) => {});
  }
  
  function accept(user) {
    let share = user.detail, folders = share['目录'] || [], 
        pages = +share.pages || 1,
        estimate = (pages - 1) * 60;
    folders = folders.filter( d => Rules.rejectFolders.indexOf(d) < 0);
    if (folders.length === 0) {
      if (share.len + estimate < Rules.minShare) {
        return false;
      }
      let docs = share['其它'] || [];
      if (docs.filter( d => typeof d !== 'string' && d.size > Rules.largFile).length > 0) {
        return true;
      }

      docs.map(d => d.title || d);
      
      docs = docs.concat(share['文档'] || []);
      let len = docs.filter( d => Rules.acceptDocs.indexOf(ext(d).slice(1)) >= 0 ).length;
      if (len === 0 || (len < Rules.minShare && pages < 2)) {
        return false;
      } else {
        return true;
      }
    }
    return true;
  }
  
  function parseShare(html) {
    let $page = $(html).find('.uk-page'),
        $list = $page.find('ul.list > li'),
        hasMorePages = $page.find('.page-list').length > 0,
        type = {};
    
    $list.each((i, li) => {
      let $t, txt, title;
      $t = $(li).find('.content > a:first-child');
      title = $t.attr('title');
      
      $t = $(li).find('.tag');
      txt = $t.text().trim();
      if (txt === '其它') {
        let arr = $(li).find('.list-content').contents().slice(1, -1).text().split(/[\u00A0\u0020]+/);
        if (arr.length > 1 && arr[2] === '---') {
          txt = '目录';
        } else {
          // potential large file
          if (arr[3] === 'MB') {
            title = {title: title, size: +arr[2]};
          }
        }
      }
      type[txt] = (type[txt] || []).concat(title);
      
    });
    let $pl = $page.find(('.page-list'));
    if ($pl.length > 0) {
      type.pages = +$pl.find('br')[0].nextSibling.nodeValue.match(/第(\d+)\/(\d+)页/)[2];
    }
    type.len = $list.length;
    return type;    
  }
  
  function check(done) {
    if (arr.length >= options.blockSize || done) {
      var fname = options.filePrefix + ('00000000' + fcnt++).slice(-8) + '.txt',
          content = JSON.stringify(arr, null, '\t');

      console.info('保存至文件: ', fname, '\t 含用户数: ', arr.length);
      cnt += arr.length;
      arr = [];
      fs.writeFile(fname, content, report);
    }
  }
  
  function parseItem(index, e) {
    let $e = $(e), $a = $e.children('a'), $d = $e.find('.list-content > b'),
        user = { uid: +$a.attr('href').slice(9), 
                name:  $a.attr('title').slice(0, -3),
               share: +$d[0].innerText || 0, 
              follow: +$d[1].innerText || 0, 
                 fan: +$d[2].innerText || 0 };
//    accept(item) && arr.push(item);
    checkUser(user);
    return user;
  }
  
  function parseOtherPage(html) {
    return $(html).find('li > .content').each(parseItem).length;
  }
  
  function parseFirstPage(html) {
    parsePage = parseOtherPage;
    return $(html).find('li > .content').each(function(index, e) {
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
        pool1.run(r);
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

        pool1.run(req[key] = () => { 
              let xhr = req[key].xhr = $.ajax(args);
              xhr.then(
                (html) => {
                      delete req[key];
                      if (parsePage(html) === 0) {
                        stop = true;
                        abortPageAfter(key);
                      } else {
                        check();
                      }
                    },
                (xhr, msg, err) => {
                      console.warn(key, msg);
                      if (err === 'abort') {
                        delete req[key];
                      } else {
                        let r = req[key];
                        r.key = key;
                        r.retry = (r.retry || 0)
                        delete r.xhr;
                        failed.push(r);
                      } 
                    }
              ).always(() => {progress.done++; checkAllDone()});
            return xhr;
          });
      }
      if (max > 0 && page >= max) { stop = true };
    }
  }
  
  $.ajaxSetup({cache: false});
  pool1.on('expect-more', more);
  pool1.on('will-makePromise', () => progress.count++);
  pool1.emit('expect-more', options.maxReq);
  
//  allDone.then(whenDone);
  
  scan.whenDone = whenDone;
}
  
let Rules = {
  'rejectFolders': '文档|我的文档|视频|电影|音乐|图片|我的图片|手机备份|game|music|专辑|专辑歌曲|歌曲|游戏|应用|分享|分享文件|共享资料文件夹|PPT模板|表情包'.split('|'),
 'acceptCategory': '其它',
     'acceptDocs': 'pdf|mobi|azw3|epub|chm|azw|prc|kfx|ebk3|kepub|caj|umd|pdg|wdl|ceb|nlc|ibooks|lrf|fb2|lit|pdb|rtf|'.split('|'),
       'minShare': 50,
      'largeFile': 64, // MB
}

module.exports = {
  scan: scan
}

// END OF CLOSED SCOPE
})();