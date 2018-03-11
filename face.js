var FaceDetect = {
  integral: [],
  integralSquared: [],
  stream: null,
  init: function() {
    var el = this;
    var c = {
      audio: false,
      video: {
        width: { ideal: 512 },
        height: { ideal: 512 }
      }
    };
    navigator.mediaDevices.getUserMedia(c)
    .then(function(stream) {
      var w = window.URL;
      var s = w.createObjectURL(stream);
      el.stream = stream;
      video.src = s;
    });
  },
  takePicture: function() {
    ctx.drawImage(video, 0, 0);
  },
  calculateII: function() {
    var el = this;
    var w = canvas.width;
    var h = canvas.height;
    var imgData = ctx.getImageData(0,0,w,h);
    var pixels = imgData.data;
    var ii = [];
    var ii2 = [];
    for(var y = 0; y < h; y++) {
      ii[y] = [];
      ii2[y] = [];
      var rowSum = 0;
      var rowSum2 = 0;
      for(var x = 0; x < w; x++) {
        var i = (x * 4) + (y * 4 * h);
        var g = pixels[i] * .3;
        g += pixels[i+1] * .59;
        g += pixels[i+2] * .11;
        pixels[i] = g;
        pixels[i+1] = g;
        pixels[i+2] = g;
        var idx = ((x - 1) > 0) ? x - 1: 0;
        var idy = ((y - 1) > 0) ? y - 1: 0;
        var iiY = (ii[idy][x]) ? ii[idy][x]: 0;
        var iiY2 = (ii2[idy][x]) ? ii2[idy][x]: 0;
        rowSum += (g * 3);
        rowSum2 += (g * 3) * (g * 3);
        ii[y][x] = rowSum + iiY;
        ii2[y][x] = rowSum2 + iiY2;
      }
    }
    this.integral = ii;
    this.integralSquared = ii2;
    ctx.putImageData(imgData,0,0);
    this.calculateThreshold(4, 1.25, 2);
  },
  /**
   *
   * @function calculateThreshold
   *
   * @params scale - The initial scale to multiply
   * the block width and height
   *
   * @params scaleFactor - How much to increase the
   * scale after successfully looping through x, y
   * of canvas with stepSize
   *
   * @params stepSize - The amount to jump between
   * x, y coordinates when looping through canvas pixels
   */
  calculateThreshold: function(scale, scaleFactor, stepSize) {
    var el = this;
    var data = cascade;
    var size = data.cascadeSize;
    var w = canvas.width;
    var h = canvas.height;
    var minWidth = size.width;
    var minHeight = size.height;
    var blockWidth = (scale * minWidth) | 0;
    var blockHeight = (scale * minHeight) | 0;
    var dataPoints = [];

    // continue until block sizes reach canvas
    // width and height values
    while(blockWidth < w && blockHeight < h) {
      var step = (scale * stepSize + 0.5) | 0;
      for(var y = 0; y < (h - blockHeight); y += step) {
        for(var x = 0; x < (w - blockWidth); x += step) {

          if(el.evalStage(data, x, y, blockWidth, blockHeight, scale)) {
            dataPoints.push({
              width: blockWidth,
              height: blockHeight,
              x: x,
              y: y
            });
          }

        }
      }
      scale *= scaleFactor;
      blockWidth = (scale * minWidth) | 0;
      blockHeight = (scale * minHeight) | 0;
    }
    if(dataPoints.length) {
      el.drawRectangles(dataPoints);
    }
  },
  highestStage: 0,
  evalStage: function(data, y, x, bW, bH, s) {
    // integral image at data point A
    // is just the x value * image width
    // plus the block width
    var el = this;
    var ii = el.integral;
    var ii2 = el.integralSquared;
    var nodeCount = 0;
    var inverseArea = 1.0/(bW * bH);
    var mean = (ii[y+bH][x+bW] - ii[y][x+bW] - ii[y+bH][x] + ii[y][x]) * inverseArea;
    var meanSquared = (ii2[y+bH][x+bW] - ii2[y][x+bW] - ii2[y+bH][x] + ii2[y][x]) * inverseArea
    var variance = meanSquared - (mean * mean);
    var deviation = 1;
    if(variance > 0) {
      deviation = Math.sqrt(variance);
    }
    for(var a = 0; a < data.nstages; a++) {
      var stage = data.stages[a];
      var stageSum = 0;
      var sThreshold = stage.stageThreshold;
      for(var b = 0; b < stage.nnodes; b++) {
        var node = stage.nodes[b];
        var nThreshold = node.threshold;
        var nLeft = node.left_val;
        var nRight = node.right_val;
        var rects = data.rects[nodeCount].data;
        var rectSum = 0;
        for(var c = 0; c < rects.length; c++) {
          // calculate rectangle values
          var r = rects[c];
          var rect = r.replace(".", "").split(" ");
          var rL =  (x + rect[0] * s + 0.5) | 0;
          var rT =  (y + rect[1] * s + 0.5) | 0;
          var rW =  (rect[2] * s + 0.5) | 0;
          var rH =  (rect[3] * s + 0.5) | 0;
          var rWeight = parseFloat(rect[4]);
          var iiA, iiB, iiC, iiD;
          // set the A point of integral image
          // as the left rect value and top rect
          // remember, in the integral image
          // the first array is the y and second
          // is the x => ii[y][x]
          iiA = ii[rT][rL];
          iiB = ii[rT][rL+rW];
          iiC = ii[rT+rH][rL]
          iiD = ii[rT+rH][rL+rW];

          // calculate the integral image
          // sum = iiA + iiD - iiB - iiC;
          rectSum += (iiD - iiB - iiC + iiA) * rWeight;
        }
        nodeCount++;
        if(rectSum * inverseArea < nThreshold * deviation) {
          stageSum += nLeft;
        } else {
          stageSum += nRight;
        }
      }
      if(a > el.highestStage) {
        el.highestStage = a;
      }
      if(stageSum < sThreshold) {
        return false;
      }
    }
    return true;
  },
  drawRectangles: function(data) {
    for(var a = 0; a < data.length; a++) {
      var d = data[a];
      ctx.rect(d.x, d.y, d.width, d.height);
    }
    ctx.stroke();
  },
  detectFace: function() {
    var el = this;
    this.calculateII();
  }
};

var canvas, video, ctx;
document.addEventListener("DOMContentLoaded", function() {

  canvas = document.getElementById("image");
  video = document.getElementById("video");
  ctx = canvas.getContext("2d");

  canvas.width = canvas.height = 512;

  var btn = document.getElementById("take-pic");
  var detect = document.getElementById("detect-face");

  btn.addEventListener("click", function() {
    FaceDetect.takePicture();
  }, false);

  detect.addEventListener("click", function() {
    FaceDetect.detectFace();
  }, false);

  FaceDetect.init();
});
