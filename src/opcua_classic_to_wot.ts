/**
 * ==========================================================================
 * Copyright (c) Sterfive 2021-2022
 *
 * *See the NOTICE file(s) distributed with this work for additional
 * information regarding copyright ownership.
 *
 * ==========================================================================
 */

import { HttpServer } from "@node-wot/binding-http";
import { ThingProperty } from "@node-wot/td-tools";
import { Servient } from "@node-wot/core";
import { OPCUAClientFactory } from "@node-wot/binding-opcua";

import { ExposedThing, InteractionOutput, PropertyReadHandler, ThingDescription } from "wot-typescript-definitions";
import { DataType } from "node-opcua-variant";
import { DataValueJSON } from "node-opcua-json";

import { getThingDescription } from "./create_wot_config";

interface makeServerClientResult {
    shutdown: () => Promise<void>;
    htmlServer: Servient;
    opcuaClient: Servient;
}
export async function makeServerClient(thingDescription: ThingDescription, port: number): Promise<makeServerClientResult> {
    const httpServientServer = new Servient();
    const httpConfig = {
        port,
    };
    const httpServer = new HttpServer(httpConfig);
    httpServientServer.addServer(httpServer);
    // htmlServer.addServer(new WebSocketServer(httpServer));
    const wotHtml = await httpServientServer.start();

    // Note:
    //   thingDescription.properties is an array of ThingProperty
    // TO DO :
    //  - Adjust the base url (it should not be OPC.TCP for a HTML Servient server)
    //   (or remove it completely)
    //  clone + modify the thingDescription to have the correct base url

    const exposedThing = await wotHtml.produce(thingDescription);

    const opcuaServientClient = new Servient();
    opcuaServientClient.addClientFactory(new OPCUAClientFactory());
    const wotOPCUA = await opcuaServientClient.start();

    // modidify all thing properties to have the form:
    const thingDescriptionWithContentType = {
        ...thingDescription,
        properties: {
            ...thingDescription.properties,
        },
    };
    Object.values(thingDescriptionWithContentType.properties).forEach((property: any) => {
        property.forms.forEach((form: any) => {
            form.contentType = "application/opcua+json;type=DataValue";
        });
    });

    const consumedThing: WoT.ConsumedThing = await wotOPCUA.consume(thingDescriptionWithContentType);
    console.log(`consume ${consumedThing.getThingDescription().title}`);

    // do the binding/glueing
    for (const [propertyName, property] of Object.entries(thingDescription.properties) as [string, ThingProperty][]) {
        exposedThing.setPropertyReadHandler(propertyName, async (options) => {
            const type =
                options && options.uriVariables && (<any>options.uriVariables).type ? (<any>options.uriVariables).type : "Value";

            const formIndex = options ? options.formIndex : 0;
            const form = property.forms[formIndex];
            const contentType = form?.contentType || `application/opcua+json;type=${type}`;

            console.log("In ReadHandler of ", propertyName, options, "contentType= ", contentType);
            try {
                const localOptions: any = {
                    uriVariables: {
                        type: "DataValue",
                    },
                };
                const content = await consumedThing.readProperty(propertyName, localOptions);
                const dataSchemaValue = await content.value();
                const dataValue = dataSchemaValue.valueOf() as DataValueJSON;

                const a = (() => {
                    switch (type) {
                        case "DataValue":
                            return dataValue;
                        case "Variant":
                            return dataValue.Value;
                        case "Value":
                        default:
                            return dataValue.Value?.Body;
                    }
                })();
                return a; // ? JSON.stringify(a) : "";
            } catch (err) {
                return JSON.stringify({ Type: DataType.String, Body: err.message.split("\n") });
            }
        });

        if (!property.readOnly) {
            // property is writable if it is not readonly (I think)
            exposedThing.setPropertyWriteHandler(
                propertyName,
                async (value: any, options?: WoT.InteractionOptions): Promise<void> => {
                    console.log("In WriteHandler of ", propertyName);
                    if ((<any>options).noOPCUA) {
                        console.log("skipping OPCUA Write");
                        return value;
                    }
                    return await consumedThing.writeProperty(propertyName, value);
                }
            );
        }
        //  exposedThing.setActionHandler(propertyName, async (params) => {});
    }

    // Question : how can I do this only if the exposed thing has received a
    // observation request for this property ?
    const oldObservation = exposedThing.setPropertyObserveHandler;
    const delegated: Record<string, unknown> = {};

    exposedThing.setPropertyObserveHandler = function (
        this: ExposedThing,
        propertyName: string,
        handler: PropertyReadHandler
    ): ExposedThing {
        if (!delegated[propertyName]) {
            delegated[propertyName] = 1;

            const listener = async (data: InteractionOutput): Promise<void> => {
                const property = (<any>exposedThing).properties[propertyName];
                const ps = property.getState();

                const value = (await data.value()) as DataValueJSON;
                const json = value;

                //     if (true) {
                //         exposedThing.writeProperty(propertyName, value, { noOPCUA: true } as WoT.InteractionOptions);
                //     } else {
                //         try {
                //             console.debug("[binding|opcua]", "In ObserveHandler of ", propertyName, "value=", value.toString());

                //             // exposedThing.writeProperty(propertyName, value);
                //             // we have to deal with private data structure .. this code might break !
                //             ps.value = jSON;
                //             const contentSerDes = ContentSerdes.get();
                //             const content = contentSerDes.valueToContent(value, property.data, "application/json");
                //             ps.subject.next(jSON);

                //             // we cannot call writeProperty here because it would cause an OPCUA call to be initiated
                //         } catch (err) {
                //             console.log("Please Fix ME ! ", err.message);
                //             console.log(err);
                //         }
                //     }
                // });
            };
            consumedThing.observeProperty(propertyName, listener);
        }
        return oldObservation.call(this, propertyName, handler);
    };

    // when ready, start the server
    await exposedThing.expose();

    const shutdown = async () => {
        httpServientServer.shutdown();
        opcuaServientClient.shutdown();
    };

    return { shutdown, htmlServer: httpServientServer, opcuaClient: opcuaServientClient };
}

async function gracefulTermination(duration: number, shutdown: () => Promise<void>): Promise<void> {
    console.log("Started ");
    await new Promise<void>((resolve) => {
        console.log("Press CTRL+C to stop ");
        const timerId = setTimeout(() => {
            shutdown().then(resolve);
        }, duration);
        process.once("SIGINT", () => {
            clearTimeout(timerId);
            console.log("Interrupted");
            shutdown().then(resolve);
        });
    });
    console.log("Done ");
}
/**
 *
 */
async function main() {
    const endpointUrl = process.argv[2] || "opc.tcp://opcuademo.sterfive.com:26543";
    // const pathToObject = `/${"[nsDI]"}:DeviceSet/${"[nsOwn]"}:CoffeeMachine/${"[nsOwn]"}:Americano`;
    const opcuaPathToObject = process.argv[3] || `/${"[nsDI]"}:DeviceSet/${"[nsOwn]"}:CoffeeMachine`;

    const port = 8080;

    if (!opcuaPathToObject) {
        console.log("usage : ts-node opcua_classic_to_wot.ts opc.tcp://localhost:48010  /3:BuildingAutomation/3:AirConditioner_1");
        process.exit(1);
    }

    const thingDescription = await getThingDescription(endpointUrl, opcuaPathToObject);

    if (thingDescription) {
        const { shutdown } = await makeServerClient(thingDescription as ThingDescription, port);
        await gracefulTermination(10 * 120 * 1000, shutdown);
    }
}

if (require.main === module) {
    main();
}
