// start server
require('server/index');

// golbal varialbes

global.$ = $;
global.SERVER_URL = 'http://localhost:8888/';
var FILE_COUNT = 1000;
var BYTES_TO_READ = 512;

if (process.platform == 'win32') {
    var randBigDir = 'D:\\';
}
else {
    var randBigDir = '/';
}

var defaultPath = process.cwd();

// import

var events = require('events');
var path = require('path');
var fs = require('fs');
require('buffer');

if (process.platform == 'win32') {
    var win32 = require("win32");
}

// local variables

var curFileCount = 0;

// main

$(document).ready(function () {

    // init
    var content = $('#content');

    // register events

    $('#Test1').click(function () {
        curFileCount = FILE_COUNT;
        console.log('测试目录: %s\n读取数量: %d\n数据大小: %d Byte', randBigDir, curFileCount, BYTES_TO_READ);

        var testName = '本地随机读取测试(同步, 无并发)';
        //content.html(testName);
        console.time(testName);
        RandReadTest_NativeSync(randBigDir);
        console.timeEnd(testName);

        curFileCount = FILE_COUNT;
        testName = 'http随机读取测试(同步, 无并发)';
        console.time(testName);
        RandReadTest_HttpSync(randBigDir, function () {
            console.timeEnd(testName);
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
    var files = fs.readdirSync(dir);
    //console.log(dir + files.length);
    for (var i = 0; i < files.length && curFileCount > 0; ++i) {
        var subPath = path.join(dir, files[i]);
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
                fs.readSync(fd, buffer, 0, BYTES_TO_READ);    
            //}
            //finally {
                fs.closeSync(fd);
            //}
        }
    }
}

// 客户端和服务端是异步通讯，但服务端采用同步方法，并发数只有一个
function RandReadTest_HttpSync(dir, callback) {
    //console.warn('get ' + dir);
    $.get(global.SERVER_URL + "navigate_sync", { path : dir })
        .done(function (data) {
            var items = data.items;
            var i = 0;
            var nextLoop = function (callNextLoop) {
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
                            .done(function () {
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