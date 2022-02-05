/**
 * ==========================================================================
 * Copyright (c) Sterfive 2021-2022
 *
 * *See the NOTICE file(s) distributed with this work for additional
 * information regarding copyright ownership.
 *
 * ==========================================================================
 */
import { DataType, DataValue, OPCUAServer, SessionContext, StatusCodes } from "node-opcua";

export async function createClassicOpcuaServer(port: number) {
    const server = new OPCUAServer({
        port,
    });

    await server.initialize();

    if (!server.engine.addressSpace) {
        throw new Error("Internal error");
    }
    const addressSpace = server.engine.addressSpace;
    const namespace = addressSpace.getOwnNamespace();
    const device = namespace.addObject({
        browseName: "MyDevice",
        organizedBy: addressSpace.rootFolder.objects,
    });
    const temperature = namespace.addVariable({
        nodeId: "ns=1;s=Temperature",
        browseName: "Temperature",
        componentOf: device,
        dataType: DataType.Double,
    });
    temperature.writeValue(
        SessionContext.defaultContext,
        new DataValue({
            value: {
                dataType: DataType.Double,
                value: 37.6,
            },
            statusCode: StatusCodes.Good,
            sourceTimestamp: new Date("2020-01-31T23:00:00Z"),
        })
    );

    await server.start();

    return server; // { server, temperature };
}
