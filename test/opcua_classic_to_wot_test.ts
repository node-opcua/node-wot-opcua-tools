/**
 * ==========================================================================
 * Copyright (c) Sterfive 2021-2022
 *
 * *See the NOTICE file(s) distributed with this work for additional
 * information regarding copyright ownership.
 *
 * ==========================================================================
 */
import { writeFileSync } from "fs";
import { OPCUAServer, DataType, StatusCodes, SessionContext, DataValue } from "node-opcua";
import { ThingDescription } from "wot-typescript-definitions";

import fetch, { Request } from "node-fetch";
import { expect } from "chai";
import { ProtocolHelpers } from "@node-wot/core";

import { getThingDescription } from "../src/create_wot_config";
import { makeServerClient } from "../src/opcua_classic_to_wot";
import { createClassicOpcuaServer } from "./fixtures/classic_opcua_server";

const httpPort = 8009;
const opcuaPort = 2002;
describe("Testing OPCUA Classic to HTTP Wot bridge bridge", () => {
    let server: OPCUAServer;
    before(async () => {
        server = await createClassicOpcuaServer(opcuaPort);
    });
    after(async () => await server.shutdown());

    describe("testing ", () => {
        let _shutdown: () => Promise<void>;
        before(async () => {
            const endpointUrl = server.getEndpointUrl();
            const opcuaPathToObject = `/${"[nsOwn]"}:MyDevice`;

            const thingDescription = await getThingDescription(endpointUrl, opcuaPathToObject);

            //  writeFileSync("tmp.json", JSON.stringify(thingDescription, null, " "), "ascii");

            const { shutdown, htmlServer, opcuaClient } = await makeServerClient(thingDescription as ThingDescription, httpPort);
            _shutdown = shutdown;
        });
        after(async () => {
            _shutdown && (await _shutdown());
        });

        it("should extract CurrentTime", async () => {
            // eslint-disable-next-line no-lone-blocks
            const response = await fetch(`http://localhost:${httpPort}/my-device/properties/CurrentTime`);
            expect(response.status).to.equal(200);
            expect(response.statusText).to.eql("OK");
            const body = (await ProtocolHelpers.readStreamFully(response.body)).toString();
            console.log("Body = ", body);
            expect(typeof body).to.equal("string");
        });
        [
            {
                name: "XA",
                contentType: "application/json",
                expected: {
                    Value: { Type: 11, Body: 37.6 },
                    SourceTimestamp: "2020-01-31T23:00:00.000Z",
                },
                extra: "?type=DataValue",
            },
            {
                name: "XB",
                contentType: "application/json",
                expected: {
                    Type: 11,
                    Body: 37.6,
                },
                extra: "?type=Variant",
            },
            {
                name: "XC",

                contentType: "application/json",
                expected: 37.6,
                extra: "?type=Value",
            },
            /*
            {
                name: "XD",
               
                contentType: "application/opcua+json;type:Variant",
                expected: { Type: 11, Body: 37.6 },
                extra: "",
            },
            {
                name: "XE",
                contentType: "application/opcua+json;type:Value;Type:Double",
                expected: 37.6,
                extra: "",
            },
            */
        ].forEach(({ name, contentType, expected, extra }, index: number) => {
            it(name + " should extract Temperature with contentType " + contentType + extra + " " + index, async () => {
                const myRequest = new Request(`http://localhost:${httpPort}/my-device/properties/Temperature` + extra, {
                    method: "GET",
                    headers: {
                        "Content-Type": contentType,
                    },
                });

                const response2 = await fetch(myRequest);
                console.log(response2);
                expect(response2.status).to.equal(200);
                expect(response2.statusText).to.eql("OK");
                const buf = await ProtocolHelpers.readStreamFully(response2.body);
                // why do we need to parse twice ?
                const body = JSON.parse(JSON.parse(buf.toString()));
                console.log("Body = ", JSON.stringify(body, null, ""));
                // delete body.SourceTimestamp;
                expect(body).to.eql(expected);
            });
        });
    });
});
