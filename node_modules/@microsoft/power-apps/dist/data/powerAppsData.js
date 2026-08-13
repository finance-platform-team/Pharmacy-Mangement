/*!
 * Copyright (C) Microsoft Corporation. All rights reserved.
 */
import { createRecordAsync } from '../internal/data/core/api/createRecord';
import { deleteFileOrImageFromRecord } from '../internal/data/core/api/deleteFileOrImageFromRecord';
import { deleteRecordAsync } from '../internal/data/core/api/deleteRecord';
import { downloadFileFromRecord } from '../internal/data/core/api/downloadFileFromRecord';
import { downloadImageFromRecord } from '../internal/data/core/api/downloadImageFromRecord';
import { executeAsync } from '../internal/data/core/api/execute';
import { retrieveMultipleRecordsAsync } from '../internal/data/core/api/retrieveMultipleRecords';
import { retrieveRecordAsync } from '../internal/data/core/api/retrieveRecord';
import { updateRecordAsync } from '../internal/data/core/api/updateRecord';
import { uploadFileToRecord } from '../internal/data/core/api/uploadRecord';
let _dataOperationExecutor;
export function getDataOperationExecutor() {
    return _dataOperationExecutor;
}
export function setDataOperationExecutor(dataOperationExecutorOverride) {
    _dataOperationExecutor = dataOperationExecutorOverride;
}
export function getClient(dataSourcesInfo) {
    return {
        createRecordAsync: (tableName, record) => {
            return createRecordAsync(dataSourcesInfo, tableName, record);
        },
        deleteRecordAsync: (tableName, recordId) => {
            return deleteRecordAsync(dataSourcesInfo, tableName, recordId);
        },
        executeAsync: (operation) => {
            return executeAsync(dataSourcesInfo, operation);
        },
        retrieveMultipleRecordsAsync: (tableName, options) => {
            return retrieveMultipleRecordsAsync(dataSourcesInfo, tableName, options);
        },
        retrieveRecordAsync: (tableName, recordId, options) => {
            return retrieveRecordAsync(dataSourcesInfo, tableName, recordId, options);
        },
        updateRecordAsync: (tableName, recordId, changes) => {
            return updateRecordAsync(dataSourcesInfo, tableName, recordId, changes);
        },
        uploadFileToRecord: (tableName, recordId, columnName, fileName, data) => {
            return uploadFileToRecord(dataSourcesInfo, tableName, recordId, columnName, fileName, data);
        },
        downloadFileFromRecord: (tableName, recordId, columnName) => {
            return downloadFileFromRecord(dataSourcesInfo, tableName, recordId, columnName);
        },
        downloadImageFromRecord: (tableName, recordId, columnName, fullSize) => {
            return downloadImageFromRecord(dataSourcesInfo, tableName, recordId, columnName, fullSize);
        },
        deleteFileOrImageFromRecord: (tableName, recordId, columnName) => {
            return deleteFileOrImageFromRecord(dataSourcesInfo, tableName, recordId, columnName);
        },
    };
}
//# sourceMappingURL=powerAppsData.js.map