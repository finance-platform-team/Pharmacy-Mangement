/*!
 * Copyright (C) Microsoft Corporation. All rights reserved.
 */
export class MockDataOperationExecutor {
    _dataStore;
    constructor(data) {
        this._dataStore = data;
    }
    async createRecordAsync(_tableName, _data) {
        return {
            success: false,
            error: { message: 'createRecordAsync is not supported by MockDataOperationExecutor' },
            data: null,
        };
    }
    async updateRecordAsync(_tableName, _id, _data) {
        return {
            success: false,
            error: { message: 'updateRecordAsync is not supported by MockDataOperationExecutor' },
            data: null,
        };
    }
    async uploadFileToRecord(tableName, id, columnName, fileName, data) {
        return {
            success: false,
            error: {
                message: `uploadFileToRecord is not supported by MockDataOperationExecutor, ${tableName}, ${columnName}, ${fileName}, ${id}, ${JSON.stringify(data)}`,
            },
            data: undefined,
        };
    }
    async downloadFileFromRecord(tableName, id, columnName) {
        return {
            success: false,
            error: {
                message: `downloadFileFromRecord is not supported by MockDataOperationExecutor, ${tableName}, ${columnName}, ${id}`,
            },
            data: new Uint8Array(0),
        };
    }
    async deleteFileOrImageFromRecord(_tableName, _recordId, _columnName) {
        return {
            success: false,
            error: {
                message: 'deleteFileOrImageFromRecord is not supported by MockDataOperationExecutor',
            },
            data: undefined,
        };
    }
    async downloadImageFromRecord(tableName, recordId, columnName, _fullSize) {
        return {
            success: false,
            error: {
                message: `downloadImageFromRecord is not supported by MockDataOperationExecutor, ${tableName}, ${columnName}, ${recordId}`,
            },
            data: new Uint8Array(0),
        };
    }
    async deleteRecordAsync(_tableName, _id) {
        return {
            success: false,
            error: { message: 'deleteRecordAsync is not supported by MockDataOperationExecutor' },
            data: undefined,
        };
    }
    async retrieveRecordAsync(tableName, id, _options) {
        if (!this._dataStore[tableName]) {
            return {
                success: false,
                error: { message: `table <${tableName}> not found` },
                data: null,
            };
        }
        const record = this._dataStore[tableName][id];
        if (!record) {
            return {
                success: false,
                error: { message: `record with id "${id}" not found in table <${tableName}>` },
                data: null,
            };
        }
        return {
            success: true,
            data: record,
        };
    }
    async retrieveMultipleRecordsAsync(tableName, _options) {
        if (!this._dataStore[tableName]) {
            return {
                success: false,
                error: { message: `table <${tableName}> not found` },
                data: [],
            };
        }
        return {
            success: true,
            data: Object.values(this._dataStore[tableName]),
        };
    }
    async executeAsync(_operation) {
        return {
            success: false,
            error: { message: 'executeAsync is not supported by MockDataOperationExecutor' },
            data: null,
        };
    }
}
export function createMockDataExecutor(data) {
    return new MockDataOperationExecutor(data);
}
//# sourceMappingURL=mockDataOperationExecutor.js.map