// start server
require('server/index');

// golbal varialbes

global.$ = $;
global.SERVER_URL = 'http://localhost:8888/';

var FILE_COUNT = 10;
var BYTES_TO_READ = 512;

if (process.platform == 'win32') {
    var randBigDir = 'D:\\K\\';
    //var randBigDir = 'D:\\K\\Dev\\node.js\\FileSystemBenchmark\\node_modules\\server';
}
else {
    var randBigDir = '/';
}

var defaultPath = process.cwd();

// import

var events = require('events');
var path = require('path');
var fs = require('fs');

if (process.platform == 'win32') {
    var win32 = require("win32");
}

// local variables

var curFileCount = 0;      // 剩余文件数
var curConcurrency = 0;    // 当前并发数
var maxConcurrency = 0;    // 最大并发数

function startTest(testName) {
    curFileCount = FILE_COUNT;
    console.log('测试中...');
    curConcurrency = 0;
    maxConcurrency = 1;

    console.time(testName);
    return {
        end : function () {
            console.timeEnd(testName);
            console.assert(curConcurrency == 0, 'curConcurrency: ' + curConcurrency);
            console.log('最终读取数量: %d 最大并发数: %d', FILE_COUNT - curFileCount, maxConcurrency);
        }
    };
}

// main

$(document).ready(function () {

    // init
    var content = $('#content');

    // register events

    $('#Test1').click(function () {
        console.log('测试目录: %s\n读取数量: %d\n数据大小: %d Byte', randBigDir, curFileCount, BYTES_TO_READ);

        var test = startTest('本地随机读取测试(同步, 无并发)');
        RandReadTest_NativeSync(randBigDir);
        test.end();

        test = startTest('http随机读取测试(同步, 无并发)');
        RandReadTest_HttpSync(randBigDir, function () {
            test.end();

            test = startTest('本地随机读取测试(异步, 并发)');
            RandReadTest_Native(randBigDir, function () {
                test.end();
            });
        });
    });
    $('#Test2').click(function () {
        content.html('');
    });
    $('#Test3').click(function () {
        content.html('');
    });
});

function RandReadTest_NativeSync(dir) {
    var items = fs.readdirSync(dir);
    //console.log(dir + items.length);
    for (var i = 0; i < items.length && curFileCount > 0; ++i) {
        var subPath = path.join(dir, items[i]);
        //console.log(subPath);
        try {
            var stat = fs.statSync(subPath);
        }
        catch (ex) {
            continue;
        }
        if (stat.isDirectory()) {
            RandReadTest_NativeSync(subPath);
        }
        else {
            --curFileCount;
            try {
                var fd = fs.openSync(subPath, "rs");
            }
            catch (ex) {
                fs.closeSync(fd);
                continue;
            }
            //try {
                var buffer = new Buffer(BYTES_TO_READ);
                buffer.fill(0);
                fs.readSync(fd, buffer, 0, BYTES_TO_READ);    
            //}
            //finally {
                fs.closeSync(fd);
            //}
        }
    }
}

// stat total concurrency
function AddConcurrency(num) {
    curConcurrency += num;
    if (curConcurrency > maxConcurrency) {
        maxConcurrency = curConcurrency;
    }
    console.assert(curConcurrency >= 0);
}

function statFiles(dir, items, callback) {
    var pending = items.length;
    for (var i = 0; i < items.length; ++i) {
        var subPath = path.join(dir, items[i]);
        //AddConcurrency(1);
        fs.stat(subPath, function functor(i2) {
            return function (err, stat) {
                //AddConcurrency(-1);
                items[i2] = { name : items[i2] };
                if (err) {
                    items[i2].type = "undefined";
                }
                else {
                    items[i2].type = (stat.isDirectory() ? "folder" : "file");
                }
                --pending;
                //console.log(pending);
                if (pending == 0) {
                    callback();
                }
            };
        }(i));
    }
    if (pending == 0) {
        callback();
    }
}

function RandReadTest_Native(dir, callback) {
    var pending = 0;
    AddConcurrency(1);
    fs.readdir(dir, function (err, items) {
        AddConcurrency(-1);
        if (err) {
            callback();
            return;
        }
        statFiles(dir, items, function () {
            //console.log(dir);
            var i = 0;
            var nextLoop = function () {
                if (i < items.length && curFileCount > 0) {
                    var subPath = path.join(dir, items[i].name);
                    //console.log(subPath);
                    var type = items[i].type;
                    ++i;
                    if (type == "undefined") {
                        --curFileCount;
                        nextLoop();
                        return;
                    }
                    else if (type == "folder") {
                        ++pending;
                        //console.log('++pending RandReadTest_Native ' + subPath + ' ' + pending);
                        RandReadTest_Native(subPath, function () {
                            --pending;
                            //console.log('--pending RandReadTest_Native ' + subPath + ' ' + pending);
                            nextLoop();
                        });
                    }
                    else {
                        ++pending;
                        //console.log('++pending open ' + subPath + ' ' + pending);
                        AddConcurrency(1);
                        fs.open(subPath, "rs", 0666, function (err, fd) {
                            if (err) {
                                console.log(err);
                                AddConcurrency(-1);
                                --pending;
                                if (pending == 0) {
                                    callback();
                                }
                                return;
                            }
                            var buffer = new Buffer(BYTES_TO_READ);
                            buffer.fill(0);
                            fs.read(fd, buffer, 0, BYTES_TO_READ, null, function (err, bytesRead, buffer) {
                                console.assert(!err);
                                fs.close(fd, function () {
                                    AddConcurrency(-1);
                                    --pending;
                                    //console.log('--pending closed ' + subPath + ' ' + pending);
                                    if (pending == 0) {
                                        callback();
                                    }
                                });
                            });
                        });
                        --curFileCount
                        nextLoop(); // we dont wait for async finished
                    }
                }
                else {
                    if (pending == 0) {
                        //console.log('pending == 0 ' + dir);
                        callback();
                    }
                }
            }
            nextLoop();
        });
    });
}

// 客户端和服务端是异步通讯，但服务端采用同步方法，并发数只有一个
function RandReadTest_HttpSync(dir, callback) {
    //console.warn('get ' + dir);
    $.get(global.SERVER_URL + "navigate_sync", { path : dir })
        .done(function (data) {
            var items = data.items;
            var i = 0;
            var nextLoop = function () {
                if (i < items.length && curFileCount > 0) {
                    var subPath = path.join(dir, items[i].name);
                    //console.log(subPath);
                    var type = items[i].type;
                    ++i;
                    if (type == 'folder') {
                        RandReadTest_HttpSync(subPath, nextLoop);
                        return;
                    }
                    else if (type == 'file') {
                        $.get(global.SERVER_URL + "open_sync", { path : subPath, length : BYTES_TO_READ })
                            .done(function (data) {
                                //console.log(data);
                                --curFileCount;
                                nextLoop();
                            })
                            .fail(function () {
                                console.error('failed to open: ' + subPath);
                                --curFileCount;
                                nextLoop();
                            });
                    }
                    else {
                        --curFileCount;
                        nextLoop();
                    }
                }
                else {
                    //console.warn('end ' + dir);
                    callback();
                }
            }
            nextLoop();
        })
        .fail(function () {
            console.error('failed to browse: ' + dir);
            callback();
        });
}