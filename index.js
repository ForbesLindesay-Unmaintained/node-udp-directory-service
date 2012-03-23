var multicast = require("multicast"),
    newId = require("uuid-pure").newId;


/**
 * Maintains a list of available services grouped by service name.
 * 
 * @param {object}  [options]                   Options to modify how the service operates
 * 
 * @param {bool}    [options.includeSelf]       Defaults to false so you don't include yourself in services listed.
 * @param {bool}    [options.logLevel]          Defaults to 2, 1-No Log, 2-Log published and subscribed services every 10 seconds, 3-log every message recieved or sent.
 * 
 * @param {string}  [options.ip]                A string containing the IP address of the multicast group, which should match 239.0.0.0/8
 * @param {int}     [options.port]              A port number for the multicast group, must be the same for everyone.
 * @param {string}  [options.socketType]        The type of socket to use (defaults to "udp4")
 * @returns {udpDirectoryService}
 */
module.exports = function udpDirectoryService(options) {
    options = options || {};
    var logLevel = options.logLevel||2;
    var services = {};
    var publishedServices = {};
    setInterval(function () {
        var reduce_ttl = function (s) { return --s.ttl; };
        for (var serv in services) {
            var startLength = services[serv].length;
            services[serv] = services[serv].filter(reduce_ttl);
            if (startLength !== services[serv].length) {
                subscribtion(serv);
            }
        }
        if(logLevel>1)console.log("Subscribed Services: " + JSON.stringify(services));
        publishServices();
    }, 5000);
    function publishServices() {
        for (var pubserv in publishedServices) {
            if(publishedServices.hasOwnProperty(pubserv)){
                send({ id: id, type: "pub", serviceName: pubserv, data: publishedServices[pubserv] });
            }
        }
        if(logLevel>1)console.log("Published Services: " + JSON.stringify(publishedServices));
    }
    var id = newId(32);
    var subscribtion = function () { };
    var send = multicast(function (message, ip) {
        if(logLevel>2)console.log("recieve("+ip+"): " + JSON.stringify(message));
        if (message.id !== id || options.includeSelf) {
            if (message.type === "pub") {
                if (!services[message.serviceName]) {
                    services[message.serviceName] = [];
                }
                var service = services[message.serviceName];
                for (var i = 0; i < service.length; i++) {
                    if (service[i].id === message.id) {
                        service[i].ttl = 4;
                        if(JSON.stringify(service[i].data)!=JSON.stringify(message.data)){
                            service[i].data = message.data;
                            subscribtion(message.serviceName);
                        }
                        return;
                    }
                }
                services[message.serviceName].push({
                    ip: ip,
                    data: message.data,
                    id: message.id,
                    ttl: 2
                });
                subscribtion(message.serviceName);
            } else if (message.type === "sub") {
                publishServices();
            }
        }
        if (message.id === id && message.type === "disc") {
            ipCallback(ip);
        }
    }, options);
    if(logLevel>2){
        (function(oldSend){
            send = function(message){
                console.log("send: " + JSON.stringify(message));
                oldSend(message);
            };
        }(send));
    }
    send({ id: id, type: "sub" });
    var ip = false;
    var ipSent = false;
    var ipCallback = function (ipAddress) {
        ip = ipAddress;
    };    
    return {
        publish: function (serviceName, data) {
            publishedServices[serviceName] = data || {};
            send({ id: id, type: "pub", serviceName: serviceName, data: data || {} });
            return this;
        },
        subscribe: function (serviceName, callback) {
            var oldSubscription = subscribtion;
            subscribtion = function (s) {
                oldSubscription(s);
                if (s === serviceName) {
                    callback(services[serviceName].map(function (v) { return { ip: v.ip, data: v.data }; }));
                }
            };
            if (services[serviceName]) {
                callback(services[serviceName].map(function (v) { return { ip: v.ip, data: v.data }; }));
            }
            return this;
        },
        services: services,
        getLocalIP: function (callback) {
            if (!ipSent) {
                ipSent = true;
                send({ id: id, type: "disc" });
            }
            if (ip) callback(ip);
            else {
                var old = ipCallback;
                ipCallback = function (ip) { callback(ip); old(ip); };
            }
        }
    };
};