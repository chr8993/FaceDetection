# Introduction
Seems like an obvious and easy task, doesn't it? The human brain is able to identify objects within milliseconds because our brains are constantly making predictions and comparing it to previous experiences. A human is able to do this very easily but a computer would need to be trained with set instructions and lots of training. If we want to build software that is able to detect faces then we will need to code our program to be able to make predictions about whether a face is in the frame or not.

In this article, we will go over the popular Viola-Jones face detection algorithm that we will use to help us identify faces within an HTML5 canvas. We will use the `getUserMedia` API to take pictures using the webcam that will be rendered on the canvas and then recognize whether there is a face in the frame or not. Face Detection using JavaScript seems like a tedious or difficult task, but it really isn't. Due to the increase of APIs made available to us via the browser, developing solutions to complicated tasks like this would have been a nightmare a few years back. The web has come so far and it's exciting to see all of these APIs being made available to web developers!

# The Viola-Jones Algorithm
The **Viola-Jones Face Detection Algorithm** is an object detection framework aimed at providing competitive object detection rates proposed by Paul Viola and Michael Jones in 2001. It can be broken down into three main components which include feature detection, integral image, and cascades. These components when combined allow for great detection rates and fast accuracy. Under this detection framework, we are not only tied to detecting faces but can also be used for detecting other objects as well. Check out [this pdf](https://www.cs.cmu.edu/~efros/courses/LBMV07/Papers/viola-cvpr-01.pdf) to find out more information regarding the Viola-Jones Algorithm.

# Features
![Haar](https://res.cloudinary.com/cinemate/image/upload/w_300,c_fill/haar_features_dzdjvb.jpg)All humans share certain facial features that allow us to identify that it is a face. Eyes and noses, for example, are easily detected by the human brain through years of training, but to a computer this means nothing. **Haar features** help a computer identify these facial features by comparing the darker areas of the face. For example, the eye region is darker than the upper-cheeks or the nose is brighter than the eyes. The Haar features can be used to help identify that there is a certain facial feature like a mouth or nose. It does this by comparing the sum of the pixel's RGB values between different areas. When combined, these features form a "cascade" of classifiers which are used to reject frames that don't contain faces. The face detection cascade has over 38 layers of classifiers and over 6060 features! The first classifier contains 2 features and rejects 50% of non-face sub-frames.

# Integral Image
A **summed-area table** or integral image is an algorithm for quickly generating the sum of values within a rectangular area of a grid. In our case, we will use summed-area tables to help us quickly sum the value of pixels within a certain region. This will help us compare between Haar features to help determine if there is a match. Integral image works by preprocessing the frame to calculate the pixel values so that at any location `x, y` contains the sum of pixels to the left and right of `x, y` inclusively. This allows us to compute the sum of a rectangular area in one pass versus having to sum the previous values again.

![Integral](https://res.cloudinary.com/cinemate/image/upload/w_400,c_fill/integral_image_a_jl7foo.jpg)

# Classifier Cascade
A **classifier cascade** is made up of classifiers which contain a certain amount of Haar features. Simpler classifiers are used at first to reject a larger amount of sub-frames that contain no face like features. More complex classifiers are later used to achieve a lower false positive rate and begin to accurately detect the face location. For example, the first classifier contains 2 features and rejects 50% of non-face containing sub-frames. The second classifier then moves up to 10 features and rejects 80%. This pattern allows for much faster face detection and a higher detection rate as well.

![Integral](https://res.cloudinary.com/cinemate/image/upload/w_600,c_fill/cascade_q6vpwz.jpg)

# Putting it Together
In order to detect faces we must first create a blank HTML5 canvas and video element that will hold our pixel data that is drawn onto the canvas. We will also need a couple of buttons with event listeners that will trigger our functions. In this example, I've set up the HTML to include two files `cascade.js` which will hold our cascade data and `face.js` which will contain all of the code behind detecting faces.
```html
<html>
  <head>
    <title>Face Detection</title>
    <link href="./styles.css" rel="stylesheet" type="text/css" />
    <script type="text/javascript" src="./cascade.js"></script>
    <script type="text/javascript" src="./face.js"></script>
  </head>
  <body>
      <h1>Face Detection</h1>
      <center>
        <button id="take-pic">Take Picture</button>
        <button id="detect-face">Detect</button>
      </center>
      <canvas id="image"></canvas>
      <video id="video" width="512" height="512" autoplay></video>
  </body>
</html>
```

Our `face.js` file will include an object called `FaceDetect` that will hold our functions that we will call. The first important function is called `calculateII`, this function will first convert the canvas pixels into grayscale for better processing. It will then iterate through the entire `pixels` array and calculate the summed area table or integral image.

```javascript
var FaceDetect = {
  integral: [],
  integralSquared: [],
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
  }
};
```
The next function is called `calculateThreshold` that will begin at the smallest block size at position (0, 0) and loop through the x and y positions within the canvas. At each step it will evaluate all stages and will exit if the stage thresholds are not met. There are a total of 22 stages that must be passed in order for a face to be detected and returned. If a face is detected, it will be put into the `dataPoints` array that contain the block size and x/y coordinates. We will use this data to draw the rectangles on the canvas where the face appears. The function `calculateThreshold` will call on `evalStage` at each x/y coordinate that will evaluate if all stages are met.

```javascript
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
      // console.info("Set scale at " + scale);
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
  }
```
The final step in face detection is actually iterating through our cascade data and calculating the sum of a given area and seeing if it exceeds some threshold. The `evalStage` function will iterate through all stages and will break if the `stageSum` does not exceed the threshold. In each stage, there are nodes that contain `rects` or rectangles with x/y coordinates and width/height of the rectangle to be traced from the block sent to the `evalStage` function.
```javascript
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
  }
```
Here is the final version of `face.js` that includes all functions and variables. Notice the additional `drawRectangles` function that will loop through all data points and draw the rectangles onto the canvas. Also, the `init` function will grab a stream from the users' webcam using the `getUserMedia` function that will get attached to the video element since we can't directly obtain the pixels without first drawing on the canvas. The full source code for this project is available on github and I recommend to check it out as it may have additional code or comments.
```javascript
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
FaceDetect.init();
```
