'use strict';

var merge2 = require('merge2');
var less = require('gulp-less');
var browserSync = require('browser-sync').create();
var imagemin = require('gulp-imagemin');
var pngquant = require('imagemin-pngquant');
var replace = require('gulp-replace');
var gulpif = require('gulp-if');
var minifyHtml = require('gulp-minify-html');
var ngHtml2Js = require('gulp-ng-html2js');
var ngmin = require('gulp-ngmin');
var browserify = require('browserify');
var ngAnnotate = require('browserify-ngannotate');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var jshint = require('gulp-jshint');
var concat = require('gulp-concat');
var inject = require('gulp-inject');
var print = require('gulp-print');
var gulp = require('gulp');
var CacheBuster = require('gulp-cachebust');
var sass = require('gulp-sass');
var config = require('./gulp-config.json');
var uglify = require('gulp-uglify');
var jshint = require('gulp-jshint');
var rename = require('gulp-rename');
var dest = require('gulp-dest');
var replace = require('gulp-replace-path');
var path = require('path');
var notify = require('gulp-notify');
var filter = require('gulp-filter');
var del = require('del');
var bytediff = require('gulp-bytediff');
var minifyCss = require('gulp-minify-css');
var sourcemaps = require('gulp-sourcemaps');
var gutil = require('gulp-util');

// -- Environment
var mode = process.env.NODE_ENV || 'prod';
var isDev = (mode === 'dev') ? true : false;
console.log('mode ',mode);
console.log('isDev ',isDev);

// -- Bust Some Cache
var cachebust = new CacheBuster();

// -- File Size Calculator (bytediffFormatter)
// (http://bendetat.com/a-useful-build-pipeline-using-gulp-and-bower.html)
function bytediffFormatter(data) {
    var formatPercent = function(num, precision) {
        return (num * 100).toFixed(precision);
    };
    var difference = (data.savings > 0) ? ' smaller.' : ' larger.';

    return data.fileName + ' went from ' +
        (data.startSize / 1000).toFixed(2) + ' kB to ' + (data.endSize / 1000).toFixed(2) + ' kB' +
        ' and is ' + formatPercent(1 - data.percent, 2) + '%' + difference;
};
// -- Clean
gulp.task('clean', function(cb){
    console.log('>>> clean');

// del returns done too early without this workaround. 
// (http://stackoverflow.com/questions/29310425/using-del-in-gulp-series)
 del.sync(config.paths.build);
 var emptyStream = gulp.src([]).pipe(gulp.dest('/'));
 return emptyStream;

});
// -- Google Map url
// Must be different for 'prod' and 'dev', doesnt function locally (known).
gulp.task('google-map',['rev-and-inject'], function(){
  console.log('>>> google-map');

  var indexPath = path.join(config.paths.build, 'index.html');
  var isProd = mode === 'prod';

  return gulp.src([indexPath])
  .pipe(gulpif(isProd,replace(config.paths.gMapDev, config.paths.gMapProd)))
  .pipe(gulp.dest(config.paths.build));

});
//-- Image Size Reduction
// Installing this module is cranky, and likely will
// require the --unsafe-perm flags at least for gifsicle
// (http://stackoverflow.com/questions/18136746/npm-install-failed-with-cannot-run-in-wd)
gulp.task('img', function(){
console.log('>>> images');

var imgPath = './' + config.paths.source + '/images/**/*';

  return gulp
  .src(imgPath)
    .pipe(imagemin({
      progressive: true,
      svgoPlugins: [{removeViewBox: false}],
      use: [pngquant()]
    }))
    .pipe(gulp.dest(config.paths.build + '/images/'));
});
// -- Bootstrap less
gulp.task('bootstrap-less',function(){
  console.log('>>> bootstrap-less');

  var stashPath = config.paths.build + '/' + config.paths.temp;

  return gulp.src(config.paths.bootstrapLess)
  .pipe(less())
  .pipe(gulp.dest(stashPath));

});
// -- Vendor-CSS
gulp.task('vendor-css', function(){
    console.log('>>> vendor css');

    var bsCssPath = config.paths.build + '/' + config.paths.temp + '/' + 'bootstrap.css';
    console.log(bsCssPath);

    return gulp
    // sources
    .src(config.paths.vendorcss)
    // sourcemaps
    .pipe(sourcemaps.init())
    // list the CSS files
    .pipe(print())
    // concat files
    .pipe(concat('vendor.min.css'))
    // save a copy before minification
    .pipe(gulpif(isDev,gulp.dest(config.paths.build + '/.tmp')))
    // start tracking size
    .pipe(bytediff.start())
    // minify css
    .pipe(minifyCss())
    // stop tracking size and output it
    .pipe(bytediff.stop(bytediffFormatter))
    // CacheBuster
    .pipe(cachebust.resources())
    .pipe(cachebust.references())
    // save sourcemaps if development
    .pipe(gulpif(isDev,sourcemaps.write('../.maps')))
    // write to dest
    .pipe(gulp.dest(config.paths.build + '/styles'));
});
// -- CSS
gulp.task('css', function(){
    console.log('>>> css');

    return gulp
    // sources
    .src(config.paths.css)
    // sourcemaps
    .pipe(sourcemaps.init())
    // list the CSS files
    .pipe(print())
    // start tracking size
    .pipe(bytediff.start())
    // precompile sass
    .pipe(sass().on('error', sass.logError))
    // concat files vendor.min.css
    .pipe(concat('main.css'))
    // save a copy before minification
    .pipe(gulpif(isDev,gulp.dest(config.paths.build + '/.tmp')))
    // minify css
    .pipe(minifyCss())
    // stop tracking size and output it using bytediffFormatter
    .pipe(bytediff.stop(bytediffFormatter))
    // CacheBuster
    .pipe(cachebust.resources())
    .pipe(cachebust.references())
    // save sourcemaps if development
    .pipe(gulpif(isDev,sourcemaps.write('../.maps')))
    // write to dest
    .pipe(gulp.dest(config.paths.build + '/styles'));
});
// -- Angular Javascript (Application)
gulp.task('js', function() {
  console.log('>>> js');

  var scriptPath = config.paths.source + '/scripts/controllers/';
  var entryJs = './' + config.paths.entry;
  var destPath = './' + config.paths.build + '/scripts/';

	return gulp
		// set sources
		.src([entryJs, path.join(scriptPath, '*.js')])
    // angular friendly
    .pipe(ngmin())
		// create a single file
		.pipe(concat('app.js'))
    // start tracking size
    .pipe(bytediff.start())
    // write non-minified
    .pipe(gulpif(isDev,gulp.dest('./build/.tmp')))
    // minify
    .pipe(uglify())
    // stop tracking size
    .pipe(bytediff.stop(bytediffFormatter))
    // Cachebuster
    .pipe(cachebust.resources())
    .pipe(cachebust.references())
		// write minified
		.pipe(gulp.dest(destPath));
});
// -- Javascript (Vendor)
gulp.task('vendor-js', function(){
  console.log('>>> vendor-js');

  var pathToVendorJs = config.paths.build + '/scripts/';

  return gulp
  // set sources
  .src(config.paths.vendorjs)
  // write to
  .pipe(concat('vendor.js'))
  // start tracking size
  .pipe(bytediff.start())
  // uglify js
  .pipe(uglify())
  // stop tracking size
  .pipe(bytediff.stop(bytediffFormatter))
  // Cachebuster
  .pipe(cachebust.resources())
  .pipe(cachebust.references())
  // write to dest
  .pipe(gulp.dest(pathToVendorJs));
});
// - Angular HTML (prepopulate $templateCache)
gulp.task('template-cache',function(){
  console.log('>>> template-cache');

  var templatesources = './' + config.paths.source + '/views/*.html';

  // non-globable files to preload
  // from includes directory:
  var t2 = config.paths.t2;
  var t3 = config.paths.t3;
  var t4 = config.paths.t4;
  var t5 = config.paths.t5;
  var t6 = config.paths.t6;
  var t7 = config.paths.t7;
  var destPath = config.paths.build + '/scripts/';

  // the two streams from different directories
  // must each be processed and then joined
  return merge2(
        gulp.src(templatesources)
        	.pipe(minifyHtml(
            {
        		empty: true,
        		spare: true,
        		quotes: true
        	}))
        	.pipe(ngHtml2Js({
        		moduleName: 'solutionsNgApp',
        		prefix: 'views/'
        	})
        ), gulp.src([
          t2,t3,t4,t5,t6,t7
        ])
        .pipe(minifyHtml(
          {
          empty: true,
          spare: true,
          quotes: true
        }))
        .pipe(ngHtml2Js({
          moduleName: 'solutionsNgApp',
          prefix: 'views/includes/'
        }))
      )
      .pipe(concat('templates.js'))
    	.pipe(uglify())
      // Cachebuster
      .pipe(cachebust.resources())
      .pipe(cachebust.references())
    	.pipe(gulp.dest(destPath));

});

// -- Copy Files
gulp.task('copy', function(){
  console.log('>>> copy');
  // the base option sets the relative root for the set of files,
  // preserving the folder structure
  return gulp.src(config.paths.filestocopy, { base: 'app' })
  .pipe(gulp.dest(config.paths.build));

});
// -- Rev-and-Inject
gulp.task('rev-and-inject',['vendor-css','css','template-cache','vendor-js','js'], function(){
  console.log('>>> rev-and-inject');

  var indexPath = path.join(config.paths.source, 'index.html');
  // use * so it pulls in the file with the dynamic cachebusting string
  var cssPath = config.paths.build + '/styles/vendor.min*';
  var jsPath = config.paths.build + '/scripts/vendor*';
  var appjsPath = config.paths.build + '/scripts/app*';
  var cachePath = config.paths.build + '/scripts/templates*';
  var sources = gulp.src([cssPath,jsPath,appjsPath,cachePath], {read:false});

  return gulp
  // sources
  .src(indexPath)
  // injection
  .pipe(inject(sources,
      {
          ignorePath: config.paths.build,
          addRootSlash: false
      }))
  // grabs the references you stored, so sweet...
  .pipe(cachebust.references())
  .pipe(gulp.dest(config.paths.build));

});
// -- Jslint
gulp.task('jslint', function(){
  console.log('>>> jslint');

  var sources = [
    config.paths.entry,
    './' + config.paths.source + '/scripts/controllers/*.js'
    ];

  return gulp
  // sources
  .src(sources)
    // Linting Javascript
  .pipe(jshint('.jshintrc'))
  .pipe(jshint.reporter('default'));

});
//-- Dev Compile Sass & Reload Browser
gulp.task('dev-sass', function() {
  console.log('>>> dev-sass');

  var destPath = './' + config.paths.source + '/styles'

  gulp
    .src(config.paths.css)
    .pipe(sass().on('error', sass.logError))
    .pipe(gulp.dest(destPath))
    .pipe(browserSync.stream());

});
// - Watch
gulp.task('watch', function() {
  console.log('>>> watch');

  var scssPath = './' + config.paths.source + '/styles/*.scss';
  var cssPath = './' + config.paths.source + '/styles/*.css';

  browserSync.init({
    proxy: "secure.ozone.international.local:8080"
  });

  gulp.watch(scssPath, ['dev-sass']);
  gulp.watch(cssPath).on('change', browserSync.reload);

});
// -- Developer Utility Tasks
gulp.task('dev',['jslint','watch'], function(){
  console.log('>>> dev');

  return gulp
  .src('')
  .pipe(notify(
    {
      onLast: true,
      message: 'Dev complete. Watching for changes...'
    }));

});

// Build ---------
gulp.task('build',['clean','rev-and-inject','google-map','copy','img'], function(){
  console.log('>>> build');

  return gulp
  .src('')
  .pipe(notify(
    {
    onLast: true,
    message: 'Build complete'
  }));
});

// Default Task
gulp.task('default',['build'], function() {
  console.log('>>> default');

});
