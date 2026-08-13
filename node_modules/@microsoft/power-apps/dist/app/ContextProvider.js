/*!
 * Copyright (C) Microsoft Corporation. All rights reserved.
 */
import { executePluginAsync } from '../internal/plugins';
let context;
export async function getContext() {
    if (context) {
        return context;
    }
    context = await executePluginAsync('AppLifecycle', 'getContext');
    return context;
}
//# sourceMappingURL=ContextProvider.js.map