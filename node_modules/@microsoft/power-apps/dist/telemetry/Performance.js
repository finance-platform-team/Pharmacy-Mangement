/*!
 * Copyright (C) Microsoft Corporation. All rights reserved.
 */
export function getAppLoadedPerformanceData() {
    const performanceApi = new PerformanceApi();
    const perfData = {
        appTimeOrigin: performanceApi.timeOrigin,
    };
    const navigationTimingEntries = performanceApi.getEntriesByType('navigation');
    const navigationTiming = navigationTimingEntries[0];
    if (navigationTiming) {
        perfData.appNavigateType = navigationTiming.type;
        perfData.appNavigationStart = navigationTiming.startTime;
        perfData.appNavigationDuration = navigationTiming.duration;
        perfData.appEncodedBodySize = navigationTiming.encodedBodySize;
        perfData.appNextHopProtocol = navigationTiming.nextHopProtocol;
        perfData.appDomainLookupStart = navigationTiming.domainLookupStart;
        perfData.appDomainLookupEnd = navigationTiming.domainLookupEnd;
        perfData.appConnectStart = navigationTiming.connectStart;
        perfData.appConnectEnd = navigationTiming.connectEnd;
        perfData.appSecureConnectionStart = navigationTiming.secureConnectionStart;
        perfData.appFetchStart = navigationTiming.fetchStart;
        perfData.appRequestStart = navigationTiming.requestStart;
        perfData.appResponseStart = navigationTiming.responseStart;
        perfData.appResponseEnd = navigationTiming.responseEnd;
        perfData.appLoadEventEnd = navigationTiming.loadEventEnd;
        perfData.appDomInteractive = navigationTiming.domInteractive;
        perfData.appDomContentLoadedEventStart = navigationTiming.domContentLoadedEventStart;
    }
    return perfData;
}
class PerformanceApi {
    _performance;
    constructor(targetWindow = window) {
        this._performance = targetWindow.performance;
    }
    get timeOrigin() {
        return this._performance?.timeOrigin;
    }
    getEntriesByType(type) {
        if (!this._performance?.getEntriesByType) {
            return [];
        }
        return this._performance.getEntriesByType(type);
    }
}
//# sourceMappingURL=Performance.js.map