/*!
 * Copyright (C) Microsoft Corporation. All rights reserved.
 */
import type { IDataOperation, IDataOperationExecutor, IOperationOptions, IOperationResult } from '../../types';
export type MockDataStore<TRecord = unknown> = {
    [tableName: string]: {
        [id: string]: TRecord;
    };
};
export declare class MockDataOperationExecutor implements IDataOperationExecutor {
    private _dataStore;
    constructor(data: MockDataStore);
    createRecordAsync<TRequest, TResponse>(_tableName: string, _data: TRequest): Promise<IOperationResult<TResponse>>;
    updateRecordAsync<TRequest, TResponse>(_tableName: string, _id: string, _data: TRequest): Promise<IOperationResult<TResponse>>;
    uploadFileToRecord<TRequest extends string | Uint8Array | ArrayBuffer | Blob>(tableName: string, id: string, columnName: string, fileName: string, data: TRequest): Promise<IOperationResult<void>>;
    downloadFileFromRecord(tableName: string, id: string, columnName: string): Promise<IOperationResult<Uint8Array>>;
    deleteFileOrImageFromRecord(_tableName: string, _recordId: string, _columnName: string): Promise<IOperationResult<void>>;
    downloadImageFromRecord(tableName: string, recordId: string, columnName: string, _fullSize?: boolean): Promise<IOperationResult<Uint8Array>>;
    deleteRecordAsync(_tableName: string, _id: string): Promise<IOperationResult<void>>;
    retrieveRecordAsync<TResponse>(tableName: string, id: string, _options?: IOperationOptions): Promise<IOperationResult<TResponse>>;
    retrieveMultipleRecordsAsync<TResponse>(tableName: string, _options?: IOperationOptions): Promise<IOperationResult<TResponse[]>>;
    executeAsync<TRequest, TResponse>(_operation: IDataOperation<TRequest>): Promise<IOperationResult<TResponse>>;
}
export declare function createMockDataExecutor(data: MockDataStore): MockDataOperationExecutor;
//# sourceMappingURL=mockDataOperationExecutor.d.ts.map