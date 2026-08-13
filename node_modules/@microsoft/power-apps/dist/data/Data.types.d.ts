/*!
 * Copyright (C) Microsoft Corporation. All rights reserved.
 */
import type { IDataOperation, IOperationOptions, IOperationResult } from '../internal/data/core/types';
export type Connection = {
    apiId: string;
    connectionName: string;
    runtimeUrl: string;
    isShareableConnection: boolean;
};
export type Connections = Record<string, Connection>;
export type DataClient = {
    createRecordAsync: <TInput, TResult>(tableName: string, record: TInput) => Promise<IOperationResult<TResult>>;
    updateRecordAsync: <TInput, TResult>(tableName: string, recordId: string, changes: TInput) => Promise<IOperationResult<TResult>>;
    uploadFileToRecord: <TInput extends string | Uint8Array | ArrayBuffer | Blob>(tableName: string, recordId: string, columnName: string, fileName: string, data: TInput) => Promise<IOperationResult<void>>;
    downloadFileFromRecord: (tableName: string, recordId: string, columnName: string) => Promise<IOperationResult<Uint8Array>>;
    downloadImageFromRecord: (tableName: string, recordId: string, columnName: string, fullSize?: boolean) => Promise<IOperationResult<Uint8Array>>;
    deleteFileOrImageFromRecord: (tableName: string, recordId: string, columnName: string) => Promise<IOperationResult<void>>;
    deleteRecordAsync: (tableName: string, recordId: string) => Promise<IOperationResult<void>>;
    retrieveRecordAsync: <TResult>(tableName: string, recordId: string, operation?: IOperationOptions) => Promise<IOperationResult<TResult>>;
    retrieveMultipleRecordsAsync: <TResult>(tableName: string, options?: IOperationOptions) => Promise<IOperationResult<TResult[]>>;
    executeAsync: <TRequest, TResult>(operation: IDataOperation<TRequest>) => Promise<IOperationResult<TResult>>;
};
//# sourceMappingURL=Data.types.d.ts.map