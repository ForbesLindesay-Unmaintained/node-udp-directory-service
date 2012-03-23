A directory service built ontop of udp to allow for p2p service discovery on a local network.

# Installation

    npm install udp-directory-service

# Example Usage

To test the sample, start it one or more times with an argument of server, and one or more times with an argument of client.

The server publishes the fact it is providing "My Fantastic Service - Version 1.0.0" and we get it's IP address and any data it has to give us.

```javascript
//All options can be left out, this shows them being explicitly set to their defaults.
//You may wish to allow the user to change the IP and Port used, in case another application already uses this IP and port
//There is no need to worry about other people using this library clashing with you, providing you have different service names.
var directoryService = require("udp-directory-service")({
    port:41834, 
    ip:"239.0.0.73", //Must match 239.0.0.0/8
    socketType:"udp4", 
    logLevel:2, 
    includeSelf:false});
    
if(process.argv[2] === "server"){
    //If on the server, publish our service.
    directoryService.publish("My Fantastic Service - Version 1.0.0", {messageOfTheDay: "Hello World"});
} else if (process.argv[2] === "client"){
    //Subscribe to a list of services to see what's available
    directoryService.subscribe("My Fantastic Service - Version 1.0.0", function(hosts){
        console.log("Available Services Changed");
        for(var i = 0; i<hosts.length; i++){
            console.log(hosts[i].ip + " MoTD is " + hosts[i].data.messageOfTheDay);
        }
    });
}
```

The interesting thing is that two applications can share a UDP port, so this app can co-exist on the same machine multiple times, as well as on separate machines.

If you don't want to see devices on the same machine, you can make use of the getLocalIP method as follows:

```javascript
//Replace client code with
directoryService.getLocalIP(function(ip){
    directoryService.subscribe("My Fantastic Service - Version 1.0.0", function(hosts){
        for(var i = 0; i<hosts.length; i++){
            if(ip != hosts[i].ip){
                console.log(hosts[i].ip + " MoTD is " + hosts[i].data.messageOfTheDay);
            }
        }
    });
});
```

You can use this IP method for any other purpose you see fit as well.

Depending on your aplication you may want to include services you publish in what you get back as a subscription.  To do this, just set the option includeSelf to false.

# API

## Options

 - ip: set the IP address for multicasting, which should match 239.0.0.0/8 (i.e. the ip address should consist of 4 bytes separted by '.' and the first byte should be 239)
 - port: The port number for multicasting, any port number can be used, providing it's not already in use for something else.  The same port number should be used by all devices wishing to communicate.
 - socketType: defaults to udp4, you can use this to move to udp6 once ipv6 has widespread support (note that you'll also need to change the IP address.
 - logLevel: how much log information do you want to output
    1. Output no log messages except the initial "Multicast server listening ip:port"
    2. Output a log message every 10 seconds with all published and subscribed services.
    3. Output a log message every time a udp message is recieved or sent (There are lots of these as by default we send heartbeats to say we're still alive)
 - includeSelf: Setting this to true includes the applicatioin subscribing in the results if it has also published.

## publish(serviceName, [serviceData])

Publish a service with the name serviceName.  It is good practice to include a version number so only compatible machines will talk to each other.  The serviceData is optional and can be any JSON serialisable data.  It is made available to clients as part of the subscription.

## subscribe(serviceName, callback(hosts))

Subscribe to a service with a service name.  Every time the available hosts change, the callback will be notified by being given a list of currently available hosts.  Each host has an ip property and a data property.

## services

An object containing arrays of hosts for all currently available services.

```javascript
console.log(services["My Service Name"].length + " host(s) are currently available for My Service Name");
```

## getLocalIP(callback(ip))

gets the local ip address by sending a udp packet and then seeing where it came from when it returns.  This may end up being called multiple times for multiple network adapters or just once for a single adaptor (it could do with improving and is subject to change).