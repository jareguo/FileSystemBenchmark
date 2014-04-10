// start server
require('server/index');

// golbal varialbes

global.$ = $;
global.SERVER_URL = 'http://localhost:8888/';

var FILE_COUNT = 1000;
var BYTES_TO_READ = 512;
global.buffer = Buffer;

if (process.platform == 'win32') {
    var TEST_DIR = 'D:\\K';
    //var TEST_DIR = 'D:\\K\\Dev\\node.js\\FileSystemBenchmark\\node_modules\\server';
}
else {
    var TEST_DIR = '/';
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
    global.buffer = new Buffer(BYTES_TO_READ);

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
    //var content = $('#content');
    $('#Dir').val(TEST_DIR);
    $('#FileCount').val(FILE_COUNT);
    $('#ByteCount').val(BYTES_TO_READ);

    // register events

    $('#Test1').click(function () {
        TEST_DIR = $('#Dir').val();
        FILE_COUNT = parseInt($('#FileCount').val());
        BYTES_TO_READ = parseInt($('#ByteCount').val());
        global.readFile = ! $('#NoReadData').prop("checked");

        console.log('测试目录: %s\n读取数量: %d\n数据大小: %d Byte ' + (global.readFile ? ' 读取文件 ' : ' 不读取文件 '), TEST_DIR, FILE_COUNT, BYTES_TO_READ);
        
        var test = startTest('本地随机读取测试(同步, 无并发)');
        RandReadTest_NativeSync(TEST_DIR);
        test.end();
    });
    $('#Test2').click(function () {
        TEST_DIR = $('#Dir').val();
        FILE_COUNT = parseInt($('#FileCount').val());
        BYTES_TO_READ = parseInt($('#ByteCount').val());
        global.readFile = ! $('#NoReadData').prop("checked");

        console.log('测试目录: %s\n读取数量: %d\n数据大小: %d Byte ' + (global.readFile ? ' 读取文件 ' : ' 不读取文件 '), TEST_DIR, FILE_COUNT, BYTES_TO_READ);

        test = startTest('http随机读取测试(同步, 无并发)');
        RandReadTest_HttpSync(TEST_DIR, function () {
            test.end();
        });
    });
    $('#Test3').click(function () {
        TEST_DIR = $('#Dir').val();
        FILE_COUNT = parseInt($('#FileCount').val());
        BYTES_TO_READ = parseInt($('#ByteCount').val());
        global.readFile = ! $('#NoReadData').prop("checked");

        console.log('测试目录: %s\n读取数量: %d\n数据大小: %d Byte ' + (global.readFile ? ' 读取文件 ' : ' 不读取文件 '), TEST_DIR, FILE_COUNT, BYTES_TO_READ);

        test = startTest('本地随机读取测试(异步, 并发)');
        RandReadTest_Native(TEST_DIR, function () {
            test.end();
        });
    });
    $('#Test4').click(function () {
        TEST_DIR = $('#Dir').val();
        FILE_COUNT = parseInt($('#FileCount').val());
        BYTES_TO_READ = parseInt($('#ByteCount').val());
        global.readFile = ! $('#NoReadData').prop("checked");

        console.log('测试目录: %s\n读取数量: %d\n数据大小: %d Byte ' + (global.readFile ? ' 读取文件 ' : ' 不读取文件 '), TEST_DIR, FILE_COUNT, BYTES_TO_READ);

        test = startTest('http随机读取测试(异步, 并发)');
        RandReadTest_Http(TEST_DIR, function () {
            test.end();
        });
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
            if (global.readFile) {
                try {
                    var fd = fs.openSync(subPath, "rs");
                }
                catch (ex) {
                    fs.closeSync(fd);
                    continue;
                }
                global.buffer.fill(0);
                fs.readSync(fd, global.buffer, 0, BYTES_TO_READ);    
                fs.closeSync(fd);
            }
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

global.statFiles = function (dir, items, callback) {
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
                    items[i2].size = 0;
                }
                else {
                    items[i2].type = (stat.isDirectory() ? "folder" : "file");
                    items[i2].size = stat.size;
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
    var pending = 0;    // 当前目录下所有子目录和文件读取完才调用callback
    AddConcurrency(1);
    fs.readdir(dir, function (err, items) {
        AddConcurrency(-1);
        if (err) {
            callback();
            return;
        }
        global.statFiles(dir, items, function () {
            //console.log(dir);
            var i = 0;
            var nextLoop = function () {
                if (i < items.length && curFileCount > 0) {
                    var subPath = path.join(dir, items[i].name);
                    //console.log(subPath);
                    var type = items[i].type;
                    var size = items[i].size;
                    ++i;
                    if (type == "folder") {
                        ++pending;
                        //console.log('++pending RandReadTest_Native ' + subPath + ' ' + pending);
                        RandReadTest_Native(subPath, function () {
                            --pending;
                            //console.log('--pending RandReadTest_Native ' + subPath + ' ' + pending);
                            nextLoop();
                        });
                    }
                    else if (global.readFile && type == 'file') {
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
                            var length = Math.max(1, Math.min(size, BYTES_TO_READ));
                            var buffer = new Buffer(length);
                            buffer.fill(0);
                            //try {
                                fs.read(fd, buffer, 0, length, null, function (err, bytesRead, buffer) {
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
                            //}
                            //catch (e) {
                            //    console.log('path ' + subPath + ' length ' + length + ' size ' + size);
                            //}
                        });
                        --curFileCount
                        nextLoop(); // we dont wait for async finished
                    }
                    else {
                        --curFileCount;
                        nextLoop();
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

function RandReadTest_Http(dir, callback) {
    var pending = 0;    // 当前目录下所有子目录和文件读取完才调用callback
    AddConcurrency(1);
    $.get(global.SERVER_URL + "navigate", { path : dir })
        .done(function (data) {
            AddConcurrency(-1);
            //console.log(dir);
            var items = data.items;
            var i = 0;
            var nextLoop = function () {
                if (i < items.length && curFileCount > 0) {
                    var subPath = path.join(dir, items[i].name);
                    //console.log(subPath);
                    var type = items[i].type;
                    var size = items[i].size;
                    ++i;
                    if (type == "folder") {
                        ++pending;
                        //console.log('++pending RandReadTest_Native ' + subPath + ' ' + pending);
                        RandReadTest_Http(subPath, function () {
                            --pending;
                            //console.log('--pending RandReadTest_Native ' + subPath + ' ' + pending);
                            nextLoop();
                        });
                    }
                    else if (global.readFile && type == 'file') {
                        ++pending;
                        //console.log('++pending open ' + subPath + ' ' + pending);
                        AddConcurrency(1);
                        $.get(global.SERVER_URL + "open", { path : subPath, length : Math.max(1, Math.min(size, BYTES_TO_READ)) })
                            .done(function (data) {
                                AddConcurrency(-1);
                                --pending;
                                //console.log('--pending closed ' + subPath + ' ' + pending);
                                if (pending == 0) {
                                    callback();
                                }
                            })
                            .fail(function () {
                                console.error('failed to open: ' + subPath);
                                AddConcurrency(-1);
                                --pending;
                                if (pending == 0) {
                                    callback();
                                }
                            });
                        --curFileCount
                        nextLoop(); // we dont wait for async finished
                    }
                    else {
                        --curFileCount;
                        nextLoop();
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
        })
        .fail(function () {
            console.error('failed to browse: ' + dir);
            AddConcurrency(-1);
            callback();
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
                    else if (global.readFile && type == 'file') {
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