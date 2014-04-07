The benchmark comparing native file system vs. http localhost.

===================

### Note 

For web server, the performance is usually measured in terms of:

* Number of requests that can be served per second (depending on the type of request, etc.);
* Latency response time in milliseconds for each new connection or request;
* Throughput in bytes per second (depending on file size, cached or not cached content, available network bandwidth, etc.).

And the measurements must be performed under a varying load of clients and requests per client.

But the http file system we tested, is not the usual sense of web server, it runs on local machine, only used personally, just as this demo: [https://github.com/jareguo/file-explorer-demo](https://github.com/jareguo/file-explorer-demo) (branch: http), so this benchmark is not exactly the same as other benchmarks for web server.
