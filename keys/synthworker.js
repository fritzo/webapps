
importScripts('riffwave.js');

self.addEventListener('message', function (e) {
  if (e.data && e.data.cmd) {
    switch (e.data.cmd) {

      case 'echo':
        self.postMessage(e.data);
        break;

      default:
        self.postMessage({cmd:'error', data:'unknown command: ' + e.data.cmd});
    }
  }
});

