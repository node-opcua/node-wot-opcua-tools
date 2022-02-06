/**
 * ==========================================================================
 * Copyright (c) Sterfive 2021-2022
 *
 * *See the NOTICE file(s) distributed with this work for additional
 * information regarding copyright ownership.
 *
 * ==========================================================================
 */
import { OPCUAClient, ClientSession, IBasicSession } from "node-opcua";
import { DataSetMetaDataType, PublishedVariableDataType } from "node-opcua-types";

import { BrokerConnectionTransport, Connection, DatagramConnectionTransport, PubSubSession } from "node-opcua-pubsub-client";
import { PublishedDataItems } from "node-opcua-pubsub-client/dist2/published_dataset";
import { DataSetWriter } from "node-opcua-pubsub-client/dist2/dataset_writer";

export interface ConnectionData {
    transport?: BrokerConnectionTransport | DatagramConnectionTransport;
    transportProfileUri: string;
    address: string;
}

export interface PubSubInfo {
    dataSetMeta: DataSetMetaDataType;
    publishedVariables: PublishedVariableDataType[];
    dataSetWriter?: DataSetWriter;
    queueName: string;
    addressUri: string;
}

export async function getConnectionDataByName(session: IBasicSession, connectionName: string): Promise<ConnectionData> {
    const connection = await getConnectionByName(session, connectionName);
    // const transport = await connection.getTransportSettings();
    const transport: undefined = undefined;
    const transportProfileUri = await connection.getTransportProfileUri();
    // getConnectionProperties(): Promise<KeyValuePair[]>;
    const address = await connection.getAddressUrl();
    return { transport, transportProfileUri, address };
}

export async function getConnectionByName(session: IBasicSession, connectionName: string): Promise<Connection> {
    const pubsubSession = new PubSubSession(session);

    const publishSubscribe = await pubsubSession.getPublishSubscribe();

    const connections = await publishSubscribe.getConnections();

    for (const connection of connections) {
        const connectionBrowseName = await connection.getBrowseName();
        if (connectionBrowseName.name === connectionName) {
            return connection;
        }
    }
    throw new Error("Connection not found");
}

export async function getDataSetWriterByName(
    publishedDataSet: PublishedDataItems,
    dataSetWriterNam: string
): Promise<DataSetWriter | null> {
    const collection = await publishedDataSet.getDataSetWriterCollection();

    for (const dataSetWriter of collection) {
        const dataSetWriterBrowseName = await dataSetWriter.getBrowseName();
        if (dataSetWriterBrowseName.name === dataSetWriterNam) {
            return dataSetWriter;
        }
    }
    return null;
}

export async function getDataSetWriterInConnectionByName(connection: Connection) {
    const groups = await connection.getWriterGroups();
    for (const group of groups) {
        const dataSetWriters = await group.getDataSetWriters();
        for (const dataSetWriter of dataSetWriters) {
            const dataSetWriterName = await dataSetWriter.getBrowseName();
            if (dataSetWriterName.name === "DataSetWriterGroup") {
                return dataSetWriter;
            }
        }
    }
}

export async function extractPubSubInfoSession(
    session: IBasicSession,
    publishedDataSetName: string,
    dataWriterName: string
): Promise<PubSubInfo> {
    const pubsubSession = new PubSubSession(session);

    const publishSubscribe = await pubsubSession.getPublishSubscribe();

    const publishedDataSets = await publishSubscribe.publishedDataSets.getPublishedDataItemsCollection();

    const map: Record<string, PublishedDataItems> = {};
    for (const dataSet of publishedDataSets) {
        const name = await dataSet.getBrowseName();
        if (!name || !name.name) {
            continue;
        }
        map[name.name.toString()] = dataSet;
    }

    const publishedDataSet = map[publishedDataSetName];
    if (!publishedDataSet) {
        
        
        console.log(`cannot find data set with name ${publishedDataSetName}.
            Valid dataset names are = ${Object.keys(map).join(" ")}`);



        return { dataSetMeta: null, publishedVariables: [], addressUri: "", queueName: "" };
    }

    const dataSetWriterCollection = await publishedDataSet.getDataSetWriterCollection();
    const map2: Record<string, DataSetWriter> = {};
    for (const dataSet of dataSetWriterCollection) {
        const name = await dataSet.getBrowseName();
        if (!name || !name.name) {
            continue;
        }
        map2[name.name.toString()] = dataSet;
    }
    const dataSetWriter = await getDataSetWriterByName(publishedDataSet, dataWriterName);

    const dataSetMeta = await publishedDataSet.getDataSetMetaData();
    const publishedVariables = await publishedDataSet.getPublishedData();

    if (!dataSetWriter) {

        console.log(`cannot find dataset writer  with name ${dataWriterName}.
            Valid dataset names for ${publishedDataSetName} are = ${Object.keys(map2).join(" ")}`);
    
        for(const d of Object.values(map2)) {
            const queueName = await d.getMetaDataQueueName();
            const browseName = await d.getBrowseName();
            console.log({ queueName, browseName,});
        }
        return { dataSetMeta: null, publishedVariables: [], addressUri: "", queueName: "" };
    }
    const connection = await dataSetWriter.getConnection();

   let addressUri = await connection.getAddressUrl();

    // const resourceUri = await dataSetWriter.getResourceUri();
    console.log("resourceUri  = ", addressUri);
    
    let queueName: string = ""
    try {
        queueName = await dataSetWriter.getQueueName();
        console.log("queueName     = ", queueName);
    } catch(err) {
    }

    return { dataSetMeta, publishedVariables, addressUri, queueName };
}

export interface ExtractPubSubInfoOptions {
    endpoint: string;
    publishedDataSetName: string;
    dataSetWriterName: string;
}
export async function extractPubSubInfo({
    endpoint,
    publishedDataSetName,
    dataSetWriterName,
}: ExtractPubSubInfoOptions): Promise<PubSubInfo> {
    const client = OPCUAClient.create({
        endpointMustExist: false,
        connectionStrategy: {
            maxRetry: 3,
        },
    });

    client.on("backoff", (nbRetry: number) => console.log("backoff",nbRetry, endpoint));

    return client.withSessionAsync(endpoint, async (session: ClientSession) => {
        return extractPubSubInfoSession(session, publishedDataSetName, dataSetWriterName);
    });
}
if (require.main === module) {
    (async () => {
        const endpoint = process.argv[2] || "opc.tcp://localhost:48010";

        const publishedDataSetName = process.argv[3] || "Simple";

        const dataSetWriterName = process.argv[4] || "WriterSimple";

        const { dataSetMeta, publishedVariables, dataSetWriter } = await extractPubSubInfo({
            endpoint,
            publishedDataSetName,
            dataSetWriterName,
        });
        console.log(dataSetMeta?.toString());
        console.log(publishedVariables?.toString());

        /*        
        console.log("transport           ", connection?.transport?.toString());
        console.log("address             ", connection?.address?.toString());
        console.log("transportProfileUri ", connection?.transportProfileUri?.toString());
*/
    })();
}
