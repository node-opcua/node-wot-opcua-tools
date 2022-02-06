/**
 * ==========================================================================
 * Copyright (c) Sterfive 2021-2022
 *
 * *See the NOTICE file(s) distributed with this work for additional
 * information regarding copyright ownership.
 *
 * ==========================================================================
 */
import { writeFile, readFile } from "fs/promises";
import { Command } from "commander";
import { ThingDescription } from "wot-thing-description-types";

import { getThingDescription } from "../src/create_wot_config";
import { buildThingDescriptionFromOPCUAPubSub, makeOPCUAPubSubServient } from "../src/opcua_pubsub_to_wot";
import { makeServerClient } from "../src/opcua_classic_to_wot";
import { extractPubSubInfo } from "../src/extract_pubsub_info";
import open from "open";

function install_getThing(program: Command) {
    program
        .command("getThing")
        .description("connect to a OPCUA to browse a node and convert it to a ThingDescription")
        .option(
            "-e, --endpoint <OPCUAendpoint uri>",
            "the opcua endpoint in the form opc.tcp://machine:port",
            "opc.tcp://opcuademo.sterfive.com:26543"
        )
        .option(
            "-n, --node  <browsePath>",
            "the browse path OPCUA object node to convert",
            "/[nsDI]:DeviceSet/[nsOwn]:CoffeeMachine"
        )
        .option("-o, --output [filename]", "the output JSON file name")
        .addHelpText(
            "after",
            `

example:

    node-wot-opcua getThing -e opc.tcp://localhost:4840 -n /3:BuildingAutomation/3:AirConditioner_1 -o thing1.json

    node-wot-opcua getThing -e opc.tcp://localhost:4840 -n /Server/ServerStatus -o thing1.json

`
        )
        .action(async (options: any) => {
            try {
                console.log(options);
                const thinkDescription = await getThingDescription(options.endpoint, options.node);
                const json = JSON.stringify(thinkDescription, null, " ");
                if (options.output) {
                    await writeFile(options.output, json, "ascii");
                } else {
                    console.log(json);
                }
            } catch (e) {
                console.log(e.message);
            }
        });
}
function install_getPubSub(program: Command) {
    program
        .command("getPubSub")
        .description("connect to a OPCUA to extract a publisher dataSet info and dump it to the console")
        .option(
            "-e, --endpoint <OPCUAendpoint uri>",
            "the opcua endpoint in the form opc.tcp://machine:port",
            "opc.tcp://opcuademo.sterfive.com:26543"
        )
        .option("-d, --dataset  <dataSetName>", "the name of the published data set to convert", "")
        .option("-w, --writer  <dataSetWriterID>", "the data set Writer", "")
        .addHelpText(
            "after",
            `

example:

    node-wot-opcua getPubSub -e opc.tcp://opcuademo.sterfive.com:26543 -d CoffeeMachinePublishedDataSet -w CoffeeMachinePublishedDataSet 
   `
        )
        .action(async (options: any) => {
            try {
                console.log(options);
                const publishedDataSetName = options.dataset;
                const dataSetWriterName = options.writer;
                const { dataSetMeta, publishedVariables, dataSetWriter } = await extractPubSubInfo({
                    endpoint: options.endpoint,
                    publishedDataSetName,
                    dataSetWriterName,
                });
                console.log(dataSetMeta?.toString());
                console.log(publishedVariables?.toString());
            } catch (e) {
                console.log(e.message);
            }
        });
}

function install_getPubSubThing(program: Command) {
    program
        .command("getPubSubThing")
        .description("connect to a OPCUA to extract a publisher dataSet and turn it to a thing")
        .option(
            "-e, --endpoint <OPCUAendpoint uri>",
            "the opcua endpoint in the form opc.tcp://machine:port",
            "opc.tcp://opcuademo.sterfive.com:26543"
        )
        .option("-d, --dataset  <dataSetName>", "the name of the published data set to convert", "")
        .option("-w, --writer  <dataSetWriterID>", "the data set Writer", "")
        .option("-o, --output [filename]", "the output JSON file name")
        .addHelpText(
            "after",
            `

example:

    node-wot-opcua getPubSubThing -e opc.tcp://opcuademo.sterfive.com:26543 -d CoffeeMachinePublishedDataSet -w CoffeeMachinePublishedDataSet -o thing2.json 
   `
        )
        .action(async (options: any) => {
            try {
                console.log(options);
                const publishedDataSetName = options.dataset;
                const dataSetWriterName = options.writer;

                const data = await extractPubSubInfo({
                    endpoint: options.endpoint,
                    publishedDataSetName,
                    dataSetWriterName,
                });
                const { dataSetMeta, publishedVariables, dataSetWriter } = data;
                const thingDescription = await buildThingDescriptionFromOPCUAPubSub(data);
                const json = JSON.stringify(thingDescription, null, " ");

                if (options.output) {
                    await writeFile(options.output, json, "ascii");
                } else {
                    console.log(json);
                }
            } catch (e) {
                console.log(e.message);
            }
        });
}

function install_runServer(program: Command) {
    program
        .command("runServer")
        .description("run a OPCUA thing description and turn it to a WOT server with a http servient")
        .option("-t, --thing <thing.json>", "the thing description file")
        .option("-p, --port <port>", "the http port", "3000")
        .addHelpText(
            "after",
            `

example:

node-wot-opcua runServer -t "thing1.json"

`
        )
        .action(async (options: any) => {
            const thing = await readFile(options.thing, "ascii");
            const thingDescription = JSON.parse(thing);
            const { shutdown } = await makeServerClient(thingDescription as ThingDescription, options.port);
            console.log("HTTP WOT Server started on port " + options.port);
            console.log("Press Ctrl+C to stop");
            open("http://localhost:" + options.port);
            process.once("SIGINT", async () => {
                await shutdown();
            });
        });
}

function install_runPubSubServer(program: Command) {
    program
        .command("runPubSubThing")
        .description("run a OPCUA  PubSub thing description and turn it to a WOT server with a http servient")
        .option(
            "-e, --endpoint <OPCUAendpoint uri>",
            "the opcua endpoint in the form opc.tcp://machine:port",
            "opc.tcp://opcuademo.sterfive.com:26543"
        )
        .option("-d, --dataset  <dataSetName>", "the name of the published data set to convert", "")
        .option("-w, --writer  <dataSetWriterID>", "the data set Writer", "")
        .option("-p, --port <port>", "the http port", "3000")
        .addHelpText(
            "after",
            `

example:

node-wot-opcua runPubSubThing -e opc.tcp://opcuademo.sterfive.com:26543 -d CoffeeMachinePublishedDataSet -w CoffeeMachinePublishedDataSet -p 3003
 
`
        )
        .action(async (options: any) => {
            console.log(options);
            const publishedDataSetName = options.dataset;
            const dataSetWriterName = options.writer;

            const data = await extractPubSubInfo({
                endpoint: options.endpoint,
                publishedDataSetName,
                dataSetWriterName,
            });
            const { shutdown } = await makeOPCUAPubSubServient(data, options.port);
            console.log("HTTP WOT Server started on port " + options.port);
            console.log("Press Ctrl+C to stop");
            open("http://localhost:" + options.port);
            process.once("SIGINT", async () => {
                await shutdown();
            });
        });
}

(async () => {
    const program = new Command();
    program.version("0.0.1");
    install_getThing(program);
    install_getPubSub(program);
    install_getPubSubThing(program);
    install_runServer(program);
    install_runPubSubServer(program);
    program.showHelpAfterError("(add --help for additional information)");
    program.showSuggestionAfterError();
    program.parse(process.argv);
})();
