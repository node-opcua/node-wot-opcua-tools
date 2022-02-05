/**
 * ==========================================================================
 * Copyright (c) Sterfive 2021-2022
 *
 * *See the NOTICE file(s) distributed with this work for additional
 * information regarding copyright ownership.
 *
 * ==========================================================================
 */
/// <reference types="wot-typescript-definitions" />

import { DataValue, NodeIdLike } from "node-opcua";
import { ThingDescription } from "wot-thing-description-types";

/// -------------------- CUT HERE ---------------------------

// import Servient from "@node-wot/core";

const endpointUrl = "";
async function getThingDescription(): Promise<Partial<ThingDescription>> {
    return {
        properties: {

        }


    };
}
async function readDataValue(endpoint: string, nodeId: NodeIdLike): Promise<DataValue> { /** */
    return new DataValue({});
}

export async function unusedMain(): Promise<void> {
    const thingDescription = await getThingDescription();

    WoT.produce(thingDescription)
        .then((thing) => {
            console.log("Produced " + thing.getThingDescription().title);
            for (const [propertyName, property] of Object.entries(thingDescription.properties)) {
                const nodeId = property.nodeId as NodeIdLike;
                thing.setPropertyReadHandler(propertyName, async () => (await readDataValue(endpointUrl, nodeId)).value?.value);
            }
            // expose the thing
            thing.expose().then(() => {
                console.info(thing.getThingDescription().title + " ready");
            });
        })
        .catch((e: Error) => {
            console.log(e);
        });
}
