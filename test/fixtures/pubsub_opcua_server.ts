/**
 * ==========================================================================
 * Copyright Sterfive 2021-2022
 *
 * Author: Etienne Rossignon - etienne.rossignon@sterfive.com
 * Licensor: sterfive.com - 833264583  RCS ORLEANS
 *
 * Unless you explicitly acquired a license to use this software from
 * Licensor, you shall not copy, use, modify, publish this file in either
 * source code or executable form.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 * OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR * PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
 * THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR  OTHER DEALINGS
 * IN THE SOFTWARE.
 *
 * ==========================================================================
 */
import {
    BrokerTransportQualityOfService,
    DataSetFieldContentMask,
    JsonDataSetMessageContentMask,
    JsonNetworkMessageContentMask,
    MessageSecurityMode,
    PublishedDataItemsDataType,
    PublishedDataSetDataType,
    PubSubConfigurationDataType,
} from "node-opcua-types";
import { AttributeIds, DataType, resolveNodeId } from "node-opcua";
import { MyMqttJsonPubSubConnectionDataType, Transport } from "node-opcua-pubsub-expander";
import { installPubSub } from "node-opcua-pubsub-server";

import { createClassicOpcuaServer } from "./classic_opcua_server";

const mqttBrokerUrl = "mqtt://broker.hivemq.com:1883";
const queueName = `opcua-demo/wot/test`;

export function getPubSubConfiguration() {
    const publishedDataSet = new PublishedDataSetDataType({
        dataSetFolder: [],
        dataSetMetaData: {
            configurationVersion: {
                majorVersion: 1,
                minorVersion: 0,
            },
            dataSetClassId: undefined,
            description: "",
            enumDataTypes: null,
            fields: [
                {
                    name: "Temperature",
                    // description of the field. The default value shall be a null LocalizedText.
                    //     description: coerceLocalizedText("some description"),
                    builtInType: DataType.Double,
                    dataType: resolveNodeId("Double"),
                },
            ],
            name: "some name",
        },
        dataSetSource: new PublishedDataItemsDataType({
            publishedData: [
                {
                    attributeId: AttributeIds.Value,
                    samplingIntervalHint: 1000,
                    publishedVariable: `ns=1;s=Temperature`,
                    substituteValue: { dataType: DataType.Double, value: 19.0 },
                    metaDataProperties: [],
                },
            ],
        }),
        extensionFields: [
            {
                key: "Unit",
                value: { dataType: DataType.String, value: "Celsius" },
            },
        ],
        name: "PublishedDataSet1",
    });

    const connection = new MyMqttJsonPubSubConnectionDataType({
        enabled: true,
        name: "MyConnectionMqttJson",
        publisherId: { dataType: DataType.String, value: "1" },
        transportProfileUri: Transport.MQTT_JSON,
        transportSettings: {
            authenticationProfileUri: null,
            resourceUri: `${mqttBrokerUrl}`, // ????
        },
        address: {
            networkInterface: null,
            url: `${mqttBrokerUrl}`,
        },
        readerGroups: [],
        writerGroups: [
            {
                dataSetWriters: [
                    {
                        dataSetFieldContentMask: DataSetFieldContentMask.None,
                        dataSetName: "PublishedDataSet1",
                        dataSetWriterId: 1,
                        dataSetWriterProperties: [],
                        enabled: true,
                        keyFrameCount: 1,
                        name: "DataSetWriter1",
                        messageSettings: {
                            dataSetMessageContentMask: JsonDataSetMessageContentMask.DataSetWriterId,
                        },
                        transportSettings: {
                            queueName,
                        },
                    },
                ],
                enabled: true,
                keepAliveTime: 0,
                publishingInterval: 1000,
                maxNetworkMessageSize: 0,
                name: "WriterGroup1",
                securityMode: MessageSecurityMode.None,
                securityGroupId: "",
                messageSettings: {
                    networkMessageContentMask:
                        JsonNetworkMessageContentMask.SingleDataSetMessage | JsonNetworkMessageContentMask.PublisherId,
                },
                transportSettings: {
                    authenticationProfileUri: null,
                    requestedDeliveryGuarantee: BrokerTransportQualityOfService.AtMostOnce,
                    queueName,
                    resourceUri: "",
                },
            },
        ],
    });

    return new PubSubConfigurationDataType({
        publishedDataSets: [publishedDataSet],
        connections: [connection],
        enabled: true,
    });
}
export async function createPubSubOpcuaServer(port: number) {
    const server = await createClassicOpcuaServer(port);

    const configuration = getPubSubConfiguration();
    await installPubSub(server, { configuration });

    return server;
}
