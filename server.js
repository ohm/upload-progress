HOST     = '0.0.0.0'; PORT     = 8080 // listen on this address/port
APP_HOST = '0.0.0.0'; APP_PORT = 3000 // sinatra listens on this address/port

var fs        = require('fs')
  , sys       = require('sys')
  , url       = require('url')
  , http      = require('http')
  , path      = require('path')
  , multipart = require(__dirname + '/vendor/multipart')

// Returns the file system path for a given upload id
function uploadPath(id) {
  return path.join(__dirname, 'tmp', id);
}

// Static request handler: Directly sends static files
function staticRequest(id, response) {
  response.writeHeader(200, {'Content-Type' : 'application/octet-stream'});

  fs.readFile(uploadPath(id), function(err, data) {
    response.end(data);
  });
}

// Returns a multipart parser instance that processes the given HTTP request
function multipartParser(request) {
  var parser = multipart.parser();

  parser.headers = request.headers; // request headers -> parser

  request.addListener('data', function(data) { // request -> parser
    parser.write(data);
  });

  request.addListener('end', function() {
    parser.close();
  });

  return parser;
}

// Proxy request handler: Proxies HTTP requests to the sinatra application
function proxyRequest(request, response) {
  var proxy        = http.createClient(APP_PORT, APP_HOST)
    , proxyRequest = proxy.request(request.method, request.url, request.headers);

  request.addListener('data', function(data) { // request -> proxy
    proxyRequest.write(data);
  });

  request.addListener('end', function() {
    proxyRequest.end();
  });

  proxyRequest.addListener('response', function(proxyResponse) {
    response.writeHead(proxyResponse.statusCode, proxyResponse.headers);

    proxyResponse.addListener('data', function(data) { // proxy -> response
      response.write(data);
    });

    proxyResponse.addListener('end', function() {
      response.end();
    });
  });
}

// Performs a HTTP request against sinatra to update an upload's progress
function reportProgress(id, progress) {
  var client = http.createClient(APP_PORT, APP_HOST)
    , update = 'progress=' + progress;

  var request = client.request('POST', id + '.json',
    {'Content-Type'   : 'application/x-www-form-urlencoded'
    ,'Content-Length' : update.length}
  );

  request.write(update);
  request.end();
}

// Upload handler: Accepts ands an upload and keeps track of progress
function handleUpload(id, request, response) {
  request.setBodyEncoding('binary');

  var requestStream  = multipartParser(request)
    , fileStream     = fs.createWriteStream(uploadPath(id))
    , totalSize      = parseInt(request.headers['content-length'])
    , partName       = null
    , byteSize       = 0;

  // once an upload has started, periodically send progress updates
  var progressReport = setInterval(function() {
    var progress = Math.ceil((byteSize / totalSize) * 100);
    reportProgress(id, progress);
  }, 1000);

  requestStream.onPartBegin = function(part) {
    partName = part.name;
  }

  requestStream.onData = function(data) { // request -> filesystem
    if( partName === 'upload' ) { // discard everything but the file upload
      request.pause(); // pause the HTTP request until the data was written
      fileStream.write(data, 'binary');
      byteSize += data.length;
    }
  }

  fileStream.addListener('drain', function() {
    request.resume(); // resume the HTTP request
  });

  requestStream.onEnd = function() {
    fileStream.addListener('drain', function() {
      fileStream.end();

      response.writeHeader(200, {'Content-Type' : 'text/plain'});
      response.write('Upload successful');
      response.end();

      clearInterval(progressReport); // stop sending periodical updates
      reportProgress(id, 100); // make sure the app is notified
    });
  }
}

var server = http.createServer(function(request, response) {
  var pathname = url.parse(request.url).pathname;

  switch( request.method ) {
    case 'GET': // proxy GET requests to sinatra, or serve uploaded file
      pathname.substr(0, 8) == '/uploads'
        ? staticRequest(pathname.substr(9), response)
        : proxyRequest(request, response);
      break;

    case 'POST': // handle uploads in node.js
      handleUpload(pathname, request, response);
      break;
  }
});

server.listen(PORT, HOST);
