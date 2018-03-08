var converter = require("./node_modules/gulp-converter-tjs/src/converter-tjs.js")();
var Readable = require('stream').Readable || require('readable-stream');
var file = "./data/cascade.xml";
var exportPath = "./data/export/cascade.json";
var fs = require('fs');

/**
 * Creates a stream w/ data.
 */
function createStream (data) {
  var rs = new Readable({ objectMode: true });
  rs.push(data);
  rs.push(null);

  return rs;
}

var xmlData = fs.readFileSync(file, "utf8");
var stream = createStream(String(xmlData));
converter.convert(stream, function(err, data) {
  if(err) {
    console.log("error");
  }
  var cascadeData = JSON.stringify(data);
  fs.writeFileSync(exportPath, cascadeData);
});
// gulp.task("default", function() {
//   gulp.src("./data/cascade.xml")
//   .pipe(converter.toTJS())
//   .pipe(gulp.dest("./data/export"));
// });
