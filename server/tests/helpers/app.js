import { createApp } from '../../src/app.js';
import { createAiService } from '../../src/services/ai/index.js';
import { mockProvider } from '../../src/services/ai/providers/mock.js';

// Every request in a test file comes from the same IP, so by default the limits are effectively off.
// Rate-limit tests pass `limits: { create: { limit: 2 } }` etc. to switch one on.
const OFF = { global: { limit: 1e6 }, create: { limit: 1e6 }, daily: { limit: 1e6 }, auth: { limit: 1e6 } };

// mode: valid | invalid-once | invalid-always | unavailable. Pass `provider` to inspect the calls it received.
// Other createApp options (limits, turnstile, clientUrl, logger, firebase) pass straight through.
export function makeApp({ mode = 'valid', provider = mockProvider({ mode }), limits, ...rest } = {}) {
  return createApp({ ai: createAiService([provider], { logger: { warn() {} } }), limits: { ...OFF, ...limits }, ...rest });
}
