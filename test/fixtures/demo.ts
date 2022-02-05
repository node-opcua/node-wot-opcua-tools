/**
 * ==========================================================================
 * Copyright (c) Sterfive 2021-2022
 *
 * *See the NOTICE file(s) distributed with this work for additional
 * information regarding copyright ownership.
 *
 * ==========================================================================
 */
import { createPubSubOpcuaServer } from "./pubsub_opcua_server";


async function main() {


    const server = await createPubSubOpcuaServer(48011);

    console.log("server started", server.getEndpointUrl());
    process.once("SIGINT", async ()=> {
        await server.shutdown();
        process.exit();
    });

}
main();