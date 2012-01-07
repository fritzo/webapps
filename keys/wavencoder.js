
var WavEncoder = function (length) {

  this.length = length;

  var PCM_FORMAT = 1;
  var bytesPerSample = 1;
  var bitsPerSample = bytesPerSample * 8;
  var numChannels = 1; // mono
  var sampleRateHz = 22050;
  var byteRateHz = sampleRateHz * bytesPerSample * numChannels;
  var byteAlignment = numChannels * bytesPerSample;

  var formatBytes = 16;
  var dataBytes = length * bytesPerSample * numChannels;
  var chunkBytes = 4 + (8 + formatBytes) + (8 + dataBytes);

  var getString = this._getString;
  var getUint16 = this._getUint16;
  var getUint32 = this._getUint32;

  var bytes = this.bytes = [].concat(
      getString('RIFF'),

      // only one chunk
      getUint32(chunkBytes),
      getString('WAVE'),

      // format subchunk
      getString('fmt '),
      getUint32(formatBytes),
      getUint16(PCM_FORMAT),
      getUint16(numChannels),
      getUint32(sampleRateHz),
      getUint32(byteRateHz),
      getUint16(byteAlignment),
      getUint16(bitsPerSample),

      // data subchunk
      getString('data'),
      getUint32(dataBytes),
      []);

  for (var h = this.headerBytes, t = 0, T = this.length; t < T; ++t, ++h) {
    bytes[h] = 0;
  }
  while (bytes.length % 3) bytes.push(0);
};

WavEncoder.prototype = {

  /*
  quantize8: function (x) { // convert real [-1,1] to integer [0,65535]
    return Math.max(0, Math.min(255, Math.floor(128 * (x + 1))));
  },
  quantize16: function (x) { // convert real [-1,1] to integer [0,65535]
    return Math.max(0, Math.min(65535, Math.floor(32768 * (x + 1))));
  },
  */

  headerBytes: 44,

  _getString: function (s) {
    var result = [];
    for (var i = 0, I = s.length; i < I; ++i) {
      var c = s.charCodeAt(i);
      assert(c < 256, 'bad character: ' + c);
      result[i] = c;
    }
    return result;
  },
  _getUint16: function (i) {
    return [i & 255, (i >> 8) & 255];
  },
  _getUint32: function (i) {
    return [i & 255, (i >> 8) & 255, (i >> 16) & 255, (i >> 24) & 255];
  },
      
  encode: function (samples) {
    // this is hard-coded for 8-bit mono

    assertEqual(samples.length, this.length, 'Wrong number of samples');

    var bytes = this.bytes;
    var pairTable = WavEncoder.pairTable;

    for (var h = this.headerBytes, t = 0, T = this.length; t < T; ++t, ++h) {
      var x = samples[t];
      //bytes[h] = Math.max(0, Math.min(255, Math.floor(128 * (x + 1))));
      bytes[h] = Math.floor(128 * (x + 1));
    }

    var result = 'data:audio/wav;base64,';
    for (var t = 0, T = bytes.length; t < T; t += 3) {
      var a8 = bytes[t + 0];
      var b8 = bytes[t + 1];
      var c8 = bytes[t + 2];

      var a12 = ((a8 << 4) | (b8 >> 4)) & 4095;
      var b12 = ((b8 << 8) | c8) & 4095;

      result += pairTable[a12] + pairTable[b12];
    }

    return result;
  }
};

(function(){

  var charTable =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

  var pairTable = [];
  for (var ij = 0, IJ = 64*64; ij < IJ; ++ij) {
    pairTable[ij] = charTable[ij >> 6] + charTable[ij & 63];
  }
  
  WavEncoder.pairTable = pairTable;
})();

