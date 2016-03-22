var http = require('http');
function single(uid, ps) { console.log(uid)
  var req = http.request({
     host: 'vdisk.weibo.com',
      path: `/wap/api/weipan/listUserItems?uid=${uid}&page_size=${ps || 10}`,
    headers: {
       dataType: 'json',
       Referer: 'http://vdisk.weibo.com/wap/u/1412362930'
      }
    }, (res) => {

  var body = '';
  res.on('data', function(chunk) {
    body += chunk;
  });
  res.on('end', function() {
    console.log(JSON.parse(body));
  });

 });
  req.end();
}
single(1412362930);