/**
 * ==========================================================================
 * Copyright (c) Sterfive 2021-2022
 *
 * *See the NOTICE file(s) distributed with this work for additional
 * information regarding copyright ownership.
 *
 * ==========================================================================
 *//// <reference types="wot-typescript-definitions" />
/// -------------------- CUT HERE ---------------------------

import { HttpServer, HttpClientFactory, HttpsClientFactory } from "@node-wot/binding-http";
import { OPCUAClientFactory } from "@node-wot/binding-opcua/src/factory";
import { Servient } from "@node-wot/core";
import { DataSetMetaDataType, PublishedVariableDataType } from "node-opcua-types";

import { extractPubSubInfo, PubSubInfo } from "./extract_pubsub_info";
import { toWotVariant } from "./to_node_wot_type";
import { JSONNetworkMessage } from "node-opcua-pubsub-expander";

async function buildThingDescription({
    dataSetMeta,
    publishedVariables,
}: {
    dataSetMeta: DataSetMetaDataType;
    publishedVariables: PublishedVariableDataType[];
}): Promise<WoT.ThingDescription> {
    const thingDescription: WoT.ThingDescription = {
        title: "some-name",
        "@context": ["https://www.w3.org/2019/wot/td/v1", { iot: "http://example.org/iot" }],
        properties: {},
        securityDefinitions: {
            nosec_sc: {
                scheme: "nosec",
            },
        },
        security: "nosec_sc",
    };

    for (let index = 0; index < dataSetMeta.fields.length; index++) {
        const field = dataSetMeta.fields[index];
        console.log("adding ", field.name);

        const wotVariant = toWotVariant(field.dataType, field.valueRank);
        thingDescription.properties[field.name] = {
            type: wotVariant.type,
            properties: wotVariant.properties,
            description: field.description.text || "",
            observable: true,
            readOnly: true,
            forms: [
                {
                    href: "",
                    contentType: "application/json",
                },
            ],
        };
    }

    return thingDescription;
}

async function getWot(port: number) {
    const htppServient = new Servient();

    const httpConfig = {
        port,
    };
    htppServient.addClientFactory(new OPCUAClientFactory());
    // servient.addClientFactory(new HttpClientFactory(httpConfig));
    // servient.addClientFactory(new HttpsClientFactory(httpConfig));

    const httpServer = new HttpServer(httpConfig);
    htppServient.addServer(httpServer);
    // servient.addServer(new WebSocketServer(httpServer));

    const wot = await htppServient.start();

    return { htppServient, wot };
}

interface MqttListener {
    client: unknown;
    payload: Record<string, unknown>;
}
async function startMQTTListener(addressUri: string, queueName: string): Promise<MqttListener> {
    const payload: Record<string, unknown> = {};

    const mqtt = require("mqtt");
    console.log("MQTT connecting to to ", addressUri);
    const client = mqtt.connect(addressUri, { clientId: "mqttjs01" });
    client.on("connected", () => {
        console.log("Connected to ", addressUri);
    });

    let counter = 0;
    client.subscribe(queueName, { qos: 1 });
    client.on("message", (topic: string, message: Buffer) => {
        if (queueName === topic) {
            const messageAsJSON: JSONNetworkMessage = JSON.parse(message.toString()) as JSONNetworkMessage;
            console.log(counter, "messageAsJSON = ", JSON.stringify(messageAsJSON, null, " "));
            counter++;
         
            const messages = (messageAsJSON.Messages instanceof Array) ? messageAsJSON.Messages : [messageAsJSON.Messages];
            for (const message of messages) {
                for (const [field,value] of Object.entries(message.Payload||{})) {
                    payload[field] = value.Body;
                }
            }
        }
    });
    return { client, payload };
}

async function stopMQTTListener(mqttListener: MqttListener): Promise<void> {
    (mqttListener.client as any).end();
}

export interface STUFF {
    mqttListener: MqttListener;
    shutdown: () => Promise<void>;
}
export async function makeOPCUAPubSubServient(data: PubSubInfo, port: number): Promise<STUFF> {
    const { dataSetMeta, publishedVariables, addressUri, queueName } = data;

    const thingDescription = await buildThingDescription(data);

    const { htppServient, wot } = await getWot(port);
    const thing = await wot.produce(thingDescription);

    console.log("Produced " + thing.getThingDescription().title);

    const mqttListener = await startMQTTListener(addressUri, queueName);
    const payload = mqttListener.payload;

    // set property handlers (using async-await)
    for (let index = 0; index < dataSetMeta.fields.length; index++) {
        const field = dataSetMeta.fields[index];
        thing.setPropertyReadHandler(field.name, async () => (payload[field.name] as any) || 0);
    }
    // expose the thing
    thing.expose().then(() => {
        console.info(thing.getThingDescription().title + " ready");
    });

    const shutdown = async () => {
        await htppServient.shutdown();
        await stopMQTTListener(mqttListener);
    };

    return { shutdown, mqttListener };
}

async function main() {
    const endpoint = "opc.tcp://localhost:48010";
    const port = 8081;
    const publishedDataSetName = "Simple";
    const dataSetWriterName = "WriterSimple";
    const data = await extractPubSubInfo({ endpoint, publishedDataSetName, dataSetWriterName });

    const thingDescription = await buildThingDescription(data);

    console.log("------------------------------ thing description");
    console.log(JSON.stringify(thingDescription, null, 2));

    const { shutdown } = await makeOPCUAPubSubServient(data, port);

    process.once("SIGINT", () => {
        shutdown().then(() => {
            console.log("MQTT listener stopped");
        });
    });
}
main();
