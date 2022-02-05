/**
 * ==========================================================================
 * Copyright (c) Sterfive 2021-2022
 *
 * *See the NOTICE file(s) distributed with this work for additional
 * information regarding copyright ownership.
 *
 * ==========================================================================
 */import { NodeId, DataType } from "node-opcua";
import { DataSchema } from "wot-typescript-definitions";

interface NodeWotType {
    type: "boolean" | "integer" | "number" | "string" | "object" | "array" | "null";
    minimum?: number;
    maximum?: number;
    basicDataType: number;
}

export function toWotVariant(dataTypeNodeId: NodeId, valueRank: number, dimensions?: number[]): DataSchema {
    if (valueRank >= 1) {
        // array or matrice
        return {
            type: "array",
            items: toWotVariant(dataTypeNodeId, -1),
        };
    }

    const { type, minimum, maximum, basicDataType } = toNodeWotType1(dataTypeNodeId, valueRank);

    return {
        type: "object",
        properties: {
            Type: {
                type: "number",
                enum: [basicDataType],
            },
            Body: {
                type,
                maximum,
                minimum,
            },
        },
    };
}
export function toNodeWotType1(dataTypeNodeId: NodeId, valueRank: number): NodeWotType {
    const basicDataType = dataTypeNodeId.value as number;

    if (dataTypeNodeId.namespace === 0) {
        switch (basicDataType) {
            case DataType.Boolean:
                return { basicDataType, type: "boolean" };
            case DataType.SByte:
                return { basicDataType, type: "integer", minimum: -128, maximum: 127 };
            case DataType.Byte:
                return { basicDataType, type: "integer", minimum: 0, maximum: 255 };
            case DataType.Int16:
                return { basicDataType, type: "integer", minimum: -32768, maximum: 32767 };
            case DataType.UInt16:
                return { basicDataType, type: "integer", minimum: 0, maximum: 65535 };
            case DataType.Int32:
                return { basicDataType, type: "integer", minimum: -2147483648, maximum: 2147483647 };
            case DataType.UInt32:
                return { basicDataType, type: "integer", minimum: 0, maximum: 4294967295 };
            case DataType.Int64:
                // eslint-disable-next-line no-loss-of-precision
                return { basicDataType, type: "integer", minimum: -9223372036854775808, maximum: 9223372036854775807 };
            case DataType.UInt64:
                // eslint-disable-next-line no-loss-of-precision
                return { basicDataType, type: "integer", minimum: 0, maximum: 18446744073709551615 };
            case DataType.Float:
                return { basicDataType, type: "number", minimum: -3.4028234663852886e38, maximum: 3.4028234663852886e38 };
            case DataType.Double:
                return { basicDataType, type: "number", minimum: -1.7976931348623157e308, maximum: 1.7976931348623157e308 };
            case DataType.String:
                return { basicDataType, type: "string" };
            case DataType.ByteString:
                return { basicDataType, type: "array" };
            default:
                return { basicDataType, type: "object" };
        }
    }
    return { basicDataType, type: "object" };
}
