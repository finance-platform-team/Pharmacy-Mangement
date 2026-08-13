/*!
 * Copyright (C) Microsoft Corporation. All rights reserved.
 */
export type AppLoadClientState = 'healthy' | 'unhealthy' | 'throttled' | 'unknown';
export type AppLoadResult = 'optimal' | 'other';
export type AppLoadNonOptimalReason = 'interactionRequired' | 'throttled' | 'screenNavigatedAway' | 'other';
export type AppLoadUnsuccessfulReason = 'AppConnectionsFailed' | 'AppForbidden' | 'AppForbiddenAppIsInQuarantine' | 'AppForbiddenPlansIssue' | 'AppIsPackaging' | 'AppLoadFailed' | 'AppNotFound' | 'CookiesBlocked' | 'InvokeScriptBlocked' | 'NetworkError' | 'PlatformError' | 'PopupError' | 'ProxyError' | 'StorageBlocked' | 'Unknown' | 'UserCancelAppConnections' | 'UserCancelled' | 'UserNotLoggedIn' | 'UserUnauthorized' | 'UserUnsupportedAppVersion' | 'UserUnsupportedBrowser';
export type SessionLoadSummaryMetricData = {
    /** The reason the app load was not considered optimal */
    appLoadNonOptimalReason?: AppLoadNonOptimalReason;
    /** The type of app load */
    appLoadResult: AppLoadResult;
    /** Whether this app launch was successful */
    successfulAppLaunch: boolean;
    /** Time in milliseconds for the app to become interactive */
    timeToAppInteractive?: number;
};
export type SessionLoadSummaryMetric = {
    data: SessionLoadSummaryMetricData;
    type: 'sessionLoadSummary';
};
export type NetworkRequestMetricData = {
    /** The URL of the network request */
    url: string;
    /** The HTTP method of the request */
    method: string;
    /** The status code of the response */
    statusCode: number;
    /** The time taken for the request in milliseconds */
    duration: number;
    /** The size of the response in bytes */
    responseSize?: number;
};
export type NetworkRequestMetric = {
    data: NetworkRequestMetricData;
    type: 'networkRequest';
};
export type Metric = SessionLoadSummaryMetric | NetworkRequestMetric;
//# sourceMappingURL=Metrics.types.d.ts.map