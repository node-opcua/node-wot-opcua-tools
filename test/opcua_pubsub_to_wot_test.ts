/**
 * ==========================================================================
 * Copyright (c) Sterfive 2021-2022
 *
 * *See the NOTICE file(s) distributed with this work for additional
 * information regarding copyright ownership.
 *
 * ==========================================================================
 */
import { OPCUAServer, UAVariable, DataType } from "node-opcua";
import { expect } from "chai";
import fetch from "node-fetch";
import { ProtocolHelpers } from "@node-wot/core";

import { extractPubSubInfo } from "../src/extract_pubsub_info";
import { makeOPCUAPubSubServient, STUFF } from "../src/opcua_pubsub_to_wot";
import { createPubSubOpcuaServer } from "./fixtures/pubsub_opcua_server";


const sleep = async (duration: number)=> await new Promise(resolve => setTimeout(resolve, duration));

const httpPort = 8010;

describe("Testing OPCUA PubSub to HTTP Wot bridge bridge", () => {
    let server: OPCUAServer;

    async function changeTemperatureInServer(temperature: number) {
        const temperatureNode = server.engine.addressSpace.findNode("ns=1;s=Temperature")! as UAVariable;
        temperatureNode.setValueFromSource({ dataType: DataType.Double, value: temperature });
    };
    before(async () => {
        const opcuaPort = 2000;
        server = await createPubSubOpcuaServer(opcuaPort);
    });
    after(async () => await server.shutdown());

    describe("", () => {
        let s: STUFF;

        before(async () => {
            const endpoint = server.getEndpointUrl();
            const publishedDataSetName = "PublishedDataSet1";
            const dataSetWriterName = "DataSetWriter1";
            const data = await extractPubSubInfo({ endpoint, publishedDataSetName, dataSetWriterName });

            s = await makeOPCUAPubSubServient(data, httpPort);
        });
        after(async () => {
            await s.shutdown();
        });

        async function readTemperatureWithFetch(): Promise<number> {
            const response = await fetch(`http://localhost:${httpPort}/some-name/properties/Temperature`);
            expect(response.status).to.equal(200);
            expect(response.statusText).to.eql("OK");
            const body = (await ProtocolHelpers.readStreamFully(response.body)).toString();
            console.log("Body = ", body);
            expect(typeof body).to.equal("string");
            return parseFloat(body);
        }
        it("some test", async () => {
            
            const t1 = await readTemperatureWithFetch();

            await changeTemperatureInServer(37.6);
            await sleep(1000);
            const t2 = await readTemperatureWithFetch();

            await changeTemperatureInServer(18.6);
            await sleep(2000);
            const t3 = await readTemperatureWithFetch();

            console.log(" T1 = ", t1, "T2=", t2, "t3=", t3);
            expect(t2).to.be.eql(37.6);
            expect(t3).to.be.eql(18.6);
        });
    });
});
