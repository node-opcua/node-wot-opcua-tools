
### node-wot opcua -tool


A set of tool to bridge the Web of Things protocol and OPCUA.

#### converting a OPCUA object to a WoT 

The `opcua_classic_to_wot` command create a Wot typedefinition  file by browsing and crawling a particular
OPCUA object. It then starts a HTTP servient so you can interact with the remote OPCUA server to read,write, subscribe to variables, or call methods.


for instance

```
$ ts-node opcua_classic_to_wot.ts opc.tcp://localhost:48010  /3:BuildingAutomation/3:AirConditioner_1
``` 

#### demo

``` 
$ ts-node opcua_classic_to_wot.ts opc.tcp://opcuademo.sterfive.com:26543  /[nsDI]:DeviceSet/[nsOwn]:CoffeeMachine

```
you can then visit the 

http://localhost:8080/coffee-machine/

or 
http://localhost:8080/coffee-machine/properties


### command getThing

Usage: 
    
    node-wot-opcua getThing [options]

connect to a OPCUA to browse a node and convert it to a ThingDescription

Options

| options | comment |
|---------|---------|
|  -e, --endpoint <OPCUAendpoint uri> | the opcua endpoint in the form opc.tcp://machine:port (default: "opc.tcp://opcuademo.sterfive.com:26543") |
|-n, --node  <browsePath> |    the browse path to  OPCUA object node to convert (default: "/[nsDI]:DeviceSet/[nsOwn]:CoffeeMachine") |`
| -o, --output [filename]  |          the output JSON file name |
|  -h, --help            |              display help for command |


examples:

    node-wot-opcua getThing -e opc.tcp://localhost:4840 -n /3:BuildingAutomation/3:AirConditioner_1 -o thing1.json

    node-wot-opcua getThing -e opc.tcp://localhost:4840 -n /Server/ServerStatus -o thing1.json


### command runServer


Usage: 

    node-wot-opcua runServer [options]

run a OPCUA thing description and turn it to a WOT server with a http servient

Options:

*   -t, --thing <thing.json>  the thing description file
*  -p, --port <port>         the http port (default: "3000")
*  -h, --help                display help for command


example:

    $ node-wot-opcua runServer -t "thing1.json"

#### converting a OPCUA PubSub datastream to a WoT 

The `opcua_pubsub_to_wot` command create a Wot typedefinition  file from 
a OPCUA PubSub MQTT datastream (JSON encoding).

It then starts a HTTP servient so you can interact with the remote OPCUA server to read or subscribe to variables.


http://localhost:3000/server-status/properties/CurrentTime?type=Value

"2022-02-06T09:05:49.690Z"

http://localhost:3000/server-status/properties/CurrentTime?type=Variant

"2022-02-06T09:05:49.690Z"



