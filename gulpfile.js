var gulp = require('gulp');
var zip = require('gulp-zip');
var fs = require('fs');
var del = require('del');
var os = require('os');
var spawn = require('child_process').spawn;
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
  var srcs = [
    'app.js',
    '503.html',
    'package.json',
    '.ebextensions/**/*',
    'lib/**/*.js',
    'public/**/*.*',
    'views/*',
    'setup/*'
  ];

  return gulp.src(srcs, {base: '.'})
    .pipe(gulp.dest('dist/'));
});

gulp.task('node-mods', function() {
  return gulp.src('./package.json')
    .pipe(gulp.dest('dist/'))
    .pipe(install({production: true, noOptional: true}));
});

gulp.task('zip', function() {
  return gulp.src(['dist/**/*'], {dot: true})
    .pipe(zip(versionNumber + '.zip'))
    .pipe(gulp.dest(os.tmpdir()));
});

gulp.task('upload', function() {
  gulp.src(os.tmpdir() + '/' + versionNumber + '.zip')
    .pipe(s3({
      bucket: 'releases.4front.io', //  Required
      ACL: 'public-read', //  Needs to be user-defined
      keyTransform: function() {
        return 'aws/' + versionNumber + '.zip';
      }
    }));
});

gulp.task('upload-latest', function() {
  gulp.src(os.tmpdir() + '/' + versionNumber + '.zip')
    .pipe(s3({
      bucket: 'releases.4front.io', //  Required
      ACL: 'public-read', //  Needs to be user-defined
      ContentDisposition: 'attachment;filename=' + versionNumber + '.zip',
      keyTransform: function() {
        return 'aws/latest.zip';
      }
    }));
});

// Run gulp on the portal module
gulp.task('portal', function(callback) {
  var spawned = spawn('gulp', ['build'], {
    cwd: './dist/node_modules/4front-portal',
    inheritStdio: true,
    waitForExit: true
  });

  spawned.on('exit', function() {
    callback();
  });

  // exec('gulp', ['build'], function (err, stdout, stderr) {
  //   console.log(stdout);
  //   console.log(stderr);
  //   cb(err);
  // });
});

gulp.task('package-json', function(callback) {
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
    ['portal'],
    ['package-json'],
    ['zip'],
    ['upload', 'upload-latest'],
    callback
  );
});
