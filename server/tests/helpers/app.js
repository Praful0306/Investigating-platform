import { createApp } from '../../src/app.js';
import { createAiService } from '../../src/services/ai/index.js';
import { mockProvider } from '../../src/services/ai/providers/mock.js';

// mode: valid | invalid-once | invalid-always | unavailable. Pass `provider` to inspect the calls it received.
export function makeApp({ mode = 'valid', provider = mockProvider({ mode }), ...rest } = {}) {
  return createApp({ ai: createAiService([provider], { logger: { warn() {} } }), ...rest });
}
