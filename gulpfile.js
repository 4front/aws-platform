var gulp = require('gulp');
var zip = require('gulp-zip');
var fs = require('fs');
var del = require('del');
var os = require('os');
var install = require('gulp-install');
var runSequence = require('run-sequence');

var s3 = require('gulp-s3-upload')({
  region: 'us-west-2'
});

var versionNumber = require('./package.json').version;

gulp.task('clean', function(cb) {
  del(['./dist', './dist.zip'], cb);
});

gulp.task('copy', function() {
  return gulp.src(['app.js', 'package.json', '.ebextensions/*', 'lib/**/*.js', 'public/*', 'views/*'], {base: "."})
    .pipe(gulp.dest('dist/'));
});

gulp.task('node-mods', function() {
  return gulp.src('./package.json')
    .pipe(gulp.dest('dist/'))
    .pipe(install({production: true, noOptional: true}));
});

gulp.task('zip', function() {
  return gulp.src(['dist/**/*'])
    .pipe(zip(versionNumber + '.zip'))
    .pipe(gulp.dest(os.tmpdir()));
});

gulp.task('upload', function() {
  gulp.src(os.tmpdir() + '/' + versionNumber + '.zip')
    .pipe(s3({
      bucket: '4front-media', //  Required
      ACL: 'public-read', //  Needs to be user-defined
      keyTransform: function(relative_filename) {
        return "platform-versions/" + versionNumber + ".zip"
      }
    }));
});

// gulp.task('uploadLatest', function() {
//   gulp.src(os.tmpdir() + '/' + versionNumber + '.zip')
//     .pipe(s3({
//       bucket: '4front-media', //  Required
//       ACL: 'public-read', //  Needs to be user-defined
//       keyTransform: function(relative_filename) {
//         return "platform-versions/_latest.zip"
//       }
//     }));
// });


gulp.task('packageJson', function(callback) {
  // Modify the package.json by clearing out the dependencies. We don't need them
  // since the .zip package contains all the node_modules. This will speed up the
  // ElasticBeanstalk deployment since it will not have any dependencies to install.
  fs.readFile('./dist/package.json', function(err, data) {
    if (err) return callback(err);

    var json = JSON.parse(data);
    json.dependencies = {};
    fs.writeFile('./dist/package.json', JSON.stringify(json, null, 2), callback);
  });
});

gulp.task('deploy', function(callback) {
  return runSequence(
    ['clean'],
    ['copy'],
    ['node-mods'],
    ['packageJson'],
    ['zip'],
    ['upload'],
    // TODO: Update the redirect rules in the S3 bucket to point to the latest version
    callback
  );
});
