/*!
 * Copyright (C) Microsoft Corporation. All rights reserved.
 */
import { SendMessage } from '../internal/plugins/SendMessage';
let loggerInstance;
export async function initializeLogger(logger) {
    loggerInstance = logger;
    const sendMessagePlugin = await SendMessage.createInstanceAsync();
    const receiver = await sendMessagePlugin.getMessageReceiverAsync('PowerApps.AppMonitorReceiver', (versionInfo) => {
        let isCompatible = false;
        if (versionInfo === '1.0.0') {
            isCompatible = true;
        }
        return { isCompatible };
    });
    if (receiver.isCompatible) {
        await receiver.sendMessage('initialize', (message) => {
            const parsedMessage = JSON.parse(message);
            if (parsedMessage.metrics) {
                for (const metric of parsedMessage.metrics) {
                    // Log the metric
                    loggerInstance.logMetric?.(metric);
                }
            }
        });
    }
}
//# sourceMappingURL=LoggerManager.js.map