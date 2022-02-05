/**
 * ==========================================================================
 * Copyright (c) Sterfive 2021-2022
 *
 * *See the NOTICE file(s) distributed with this work for additional
 * information regarding copyright ownership.
 *
 * ==========================================================================
 */
import { kebabCase } from "case-anything";

import {
    makeBrowsePath,
    OPCUAClient,
    resolveNodeId,
    ObjectIds,
    StatusCodes,
    BrowseDirection,
    IBasicSession,
    NodeId,
    NodeClass,
    AttributeIds,
    ReferenceDescription,
    Range,
    DataValue,
    VariableIds,
    QualifiedName,
    AccessLevelFlag,
    LocalizedText,
    //   EUInformation,
} from "node-opcua";
import { Argument, EUInformation } from "node-opcua-types";
import { readNamespaceArray } from "node-opcua-pseudo-session";

import { Helpers } from "@node-wot/core";
import { ExposedThingInit } from "wot-typescript-definitions";
import { ActionElement, DataSchema } from "wot-thing-description-types";
import { OPCUAFormElement } from "@node-wot/binding-opcua2/src/opcua_protocol_client";
import { toWotVariant } from "./to_node_wot_type";

const objectFolderNodeId = resolveNodeId(ObjectIds.ObjectsFolder);

async function extractEURange(session: IBasicSession, nodeId: NodeId): Promise<Range | null> {
    const result = await session.translateBrowsePath(makeBrowsePath(nodeId, "/EURange"));
    if (result.statusCode !== StatusCodes.Good) {
        return null;
    }
    const euRangeNodeId = result.targets[0].targetId;
    const dataValue = await session.read({ nodeId: euRangeNodeId, attributeId: AttributeIds.Value });
    return dataValue.value.value as Range;
}
async function extractEngineeringUnits(session: IBasicSession, nodeId: NodeId): Promise<EUInformation | null> {
    const result = await session.translateBrowsePath(makeBrowsePath(nodeId, "/EngineeringUnits"));
    if (result.statusCode !== StatusCodes.Good) {
        return null;
    }
    const engineeringUnitsNodeIds = result.targets[0].targetId;
    const dataValue = await session.read({ nodeId: engineeringUnitsNodeIds, attributeId: AttributeIds.Value });
    return dataValue.value.value as EUInformation;
}
async function readArguments(session: IBasicSession, nodeId: NodeId): Promise<Argument[]> {
    const dataValue = await session.read({ nodeId, attributeId: AttributeIds.Value });
    return dataValue.value.value as Argument[];
}
async function extractInputAndOutputArguments(
    session: IBasicSession,
    methodId: NodeId
): Promise<{ inputArguments: Argument[]; outputArguments: Argument[] }> {
    const [inputResult, outputResult] = await session.translateBrowsePath([
        makeBrowsePath(methodId, "/InputArguments"),
        makeBrowsePath(methodId, "/OutputArguments"),
    ]);
    let inputArguments: Argument[] = [];
    let outputArguments: Argument[] = [];
    if (inputResult.statusCode === StatusCodes.Good) {
        inputArguments = await readArguments(session, inputResult.targets[0].targetId);
    }
    if (outputResult.statusCode === StatusCodes.Good) {
        outputArguments = await readArguments(session, outputResult.targets[0].targetId);
    }
    return { inputArguments, outputArguments };
}
interface Extra {
    endpoint: string;
}

function convertArgument(opcuaArgument: Argument): DataSchema {
    const wotVariant = toWotVariant(opcuaArgument.dataType, opcuaArgument.valueRank);
    return {
        type: wotVariant.type,
        properties: wotVariant.properties,
        title: opcuaArgument.description.text || "",
        //  type: toNodeWotType(argument.dataType),
        //     description: argument.description?.text || "",
        description: opcuaArgument.description.text || "",
        
    };
}
function turnArguments(opcuaArguments: Argument[]): DataSchema {
    const wotArguments: DataSchema = {
        type: "object",
        properties: {},
    };
    const properties = wotArguments.properties;

    const argumentNames: string[] = [];
    for (const argument of opcuaArguments) {
        const argumentName = argument.name.toString();
        properties[argumentName] = convertArgument(argument);

        argumentNames.push(argumentName);
    }
    return wotArguments;
}
async function addActionInThingDescription(
    name: string,
    session: IBasicSession,
    reference: ReferenceDescription,
    thingDescription: ExposedThingInit,
    extra: Extra
): Promise<void> {
  

    const nodeId = reference.nodeId;
    const description = (await session.read({ nodeId, attributeId: AttributeIds.Description })).value.value;
    const { inputArguments, outputArguments } = await extractInputAndOutputArguments(session, nodeId);

    const { type } = { type: "object"};
    
    const action: ActionElement = {
        href: "/",
        type,
        description: description?.text || "",
        forms: [
            {
                href: "/",
            },
        ],
    };

    thingDescription.actions =  thingDescription.actions || {};
    thingDescription.actions[name] = action;

    if (inputArguments.length) {
        action.input = turnArguments(inputArguments);
    }

    if (outputArguments.length) {
        action.output = turnArguments(outputArguments);
    }
}
async function addPropertyInThingDescription(
    name: string,
    session: IBasicSession,
    reference: ReferenceDescription,
    thingDescription: ExposedThingInit,
    extra: Extra
): Promise<void> {
    const nodeId = reference.nodeId;

    const description = (await session.read({ nodeId, attributeId: AttributeIds.Description })).value.value as LocalizedText;
    const dataTypeNodeId = (await session.read({ nodeId, attributeId: AttributeIds.DataType })).value.value as NodeId;
    const valueRank = (await session.read({ nodeId, attributeId: AttributeIds.ValueRank })).value.value as number;
    const accessLevel = (await session.read({ nodeId, attributeId: AttributeIds.UserAccessLevel })).value.value as number;

    const wotVariant = toWotVariant(dataTypeNodeId, valueRank);
    thingDescription.properties[name] = {
        href: "/",
        type: wotVariant.type,
        properties: wotVariant.properties,
        description: description?.text || "",
        observable: true,
        readOnly: true,
        // special properties (just for us)
        nodeId,
        forms: [
            {
                href: "/",
            },
        ],
    };

    const euRange = await extractEURange(session, nodeId);
    const units = (await extractEngineeringUnits(session, nodeId))?.displayName?.text?.toString() || undefined;

    if (euRange) {
        // is this standard ?
        thingDescription.properties[name].minimum = euRange.low;
        thingDescription.properties[name].maximum = euRange.high;
    }
    if (units) {
        thingDescription.properties[name].units = units.toString();
    }

    const form: OPCUAFormElement = {
        href: "/",
        op: ["readproperty", "observeproperty", "unobserveproperty"],
        "opcua:nodeId": nodeId.toString(),
       //  contentType: "application/opcua+json;type=Variant",
       contentType: "application/json",
    };

    if ((accessLevel & AccessLevelFlag.CurrentWrite) === AccessLevelFlag.CurrentWrite) {
        form.op = ["readproperty", "observeproperty", "unobserveproperty"];
    }

    thingDescription.properties[name].forms = [form];
    thingDescription.properties[name].uriVariables = {
        type: {
            type: "string",
            enum: ["DataValue", "Variant", "Value"],
        },
    };
    /*
     uriVariables: {
                id: {
                    type: 'string', 
                    enum: ['water', 'milk', 'chocolate', 'coffeeBeans'],
                },
            },
        */
}

async function exploreNode(thingDescription: ExposedThingInit, extra: Extra, session: IBasicSession, nodeId: NodeId, prefix = "") {
    const browseResult = await session.browse({
        browseDirection: BrowseDirection.Forward,
        nodeId,
        includeSubtypes: true,
        referenceTypeId: "HasChild",
        nodeClassMask: 0xfff,
        resultMask: 0x3f,
    });
    // console.log(browseResult.toString());
    if (browseResult.statusCode !== StatusCodes.Good) {
        console.log(" browse failed");
        return;
    }

    for (const reference of browseResult.references) {
        const name = prefix + reference.browseName.name.toString();
        switch (reference.nodeClass) {
            case NodeClass.Variable:
                await addPropertyInThingDescription(name, session, reference, thingDescription, extra);
                await exploreNode(thingDescription, extra, session, reference.nodeId, name + ".");
                break;
            case NodeClass.Object:
                await exploreNode(thingDescription, extra, session, reference.nodeId, name + ".");
                break;
            case NodeClass.Method:
                await addActionInThingDescription(name, session, reference, thingDescription, extra);
                break;
            default:
            /* ignore */
        }
    }
}

async function readDataValue(endpoint: string, nodeId: NodeId): Promise<DataValue> {
    const client = OPCUAClient.create({
        connectionStrategy: {
            maxRetry: 1,
        },
    });
    const dataValue = await client.withSessionAsync(endpoint, async (session) => {
        const dataValue = await session.read({ nodeId, attributeId: AttributeIds.Value });
        return dataValue;
    });
    return dataValue;
}

export async function getThingDescriptionFromSession(
    session: IBasicSession,
    pathToObject: string,
    extra: Extra
): Promise<ExposedThingInit> {
    const namespaces = await readNamespaceArray(session);
    const nsDI = namespaces.findIndex((value) => value === "http://opcfoundation.org/UA/DI/");
    if (!nsDI) {
        console.log("Namespace DI not found");
        return;
    }
    const nsOwn = 1;

    const pathToObject2 = pathToObject.replace(/\[nsDI\]/g, nsDI.toString()).replace(/\[nsOwn\]/g, nsOwn.toString());

    // browse the device set folder
    const result = await session.translateBrowsePath(makeBrowsePath(objectFolderNodeId, pathToObject2));
    if (result.statusCode !== StatusCodes.Good) {
        console.log(" cannot find object", pathToObject2.toString());
        return;
    }
    const deviceNodeId = result.targets[0].targetId;
    console.log(" device NodeId ", deviceNodeId.toString());

    const browseName = await session.read({ nodeId: deviceNodeId, attributeId: AttributeIds.BrowseName });
    const title = kebabCase((browseName.value.value as QualifiedName).name.toString());

    const thingDescription: ExposedThingInit = {
        "@context": ["https://www.w3.org/2019/wot/td/v1", { iot: "http://example.org/iot" }],
        "@type": ["Thing"],
        securityDefinitions: { nosec_sc: { scheme: "nosec" } },
        security: "nosec_sc",

        title,

        "opcua:commonConfig": {
            securitySetting: "",
            default_endpoint: "",
        },

        base: extra.endpoint,
        properties: {},
    };

    const form1: OPCUAFormElement = {
        href: extra.endpoint || "",
        op: ["readproperty" ,"observeproperty"], //  "observeproperty", "unobserveproperty"],
        // special properties (just for us)
        "opcua:nodeId": resolveNodeId(VariableIds.Server_ServerStatus_CurrentTime),
        //  contentType: "application/opcua+json;type=DataValue",
        contentType: "application/json",
    };

    const form2: OPCUAFormElement = {
        href: extra.endpoint || "",
        op: ["readproperty", "observeproperty"], //  "observeproperty", "unobserveproperty"],
        // special properties (just for us)
        "opcua:nodeId": resolveNodeId(VariableIds.Server_ServerStatus_CurrentTime),
        //  contentType: "application/opcua+json;type=DataValue",
        contentType: "application/json",
    };
    thingDescription.properties.CurrentTime = {
        href: "/",
        type: "object", // toNodeWotType(resolveNodeId(DataType.DateTime)),
        description: "current time",
        observable: true,
        readOnly: true,
        //  contentType: "application/opcua+json;type=DataValue",
        contentType: "application/json",
        forms: [form1, form2],
    };
    // now explore the object
    await exploreNode(thingDescription, extra, session, deviceNodeId);

    const validated = Helpers.validateExposedThingInit(thingDescription);
    if (!validated.valid) {
        console.log(validated.errors);
    }
    return thingDescription;
}

export async function getThingDescription(endpoint: string, pathToObject: string): Promise<ExposedThingInit> {
    const client = OPCUAClient.create({
        endpointMustExist: false,
        connectionStrategy: {
            maxRetry: 1,
        },
    });
    const extra: Extra = {
        endpoint,
    };
    const thingDescription = await client.withSessionAsync(endpoint, async (session) => {
        return getThingDescriptionFromSession(session, pathToObject, extra);
    });

    // console.log("thingDescription", thingDescription);
    return thingDescription;
}

if (require.main === module) {
    (async () => {
        const endpoint = process.argv[2] || "opc.tcp://localhost:48010";
        const opcuaPathToObject = process.argv[3];
        if (!opcuaPathToObject) {
            console.log("usage : node a.js opc.tcp://localhost:48010   /3:BuildingAutomation/3:AirConditioner_1");
            process.exit(1);
        }
        const td = await getThingDescription(endpoint, opcuaPathToObject);
        console.log(JSON.stringify(td, null, " "));
    })();
}
