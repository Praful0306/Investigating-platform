import { describe, expect, it, vi } from 'vitest';
import { mockProvider } from '../../src/services/ai/providers/mock.js';
import { AppError } from '../../src/utils/app-error.js';

// A bug in OUR code (here: the validator throws) must not look like "the AI is busy".
vi.mock('../../src/services/ai/validate.js', () => ({
  validateGenerated: () => { throw new TypeError('validator bug: cannot read properties of undefined'); },
}));
const { createAiService } = await import('../../src/services/ai/index.js');

describe('createAiService: internal bugs are not disguised as provider outages', () => {
  it('an error thrown by our own validation code reaches the caller (so the error handler logs it and the player gets a 500)', async () => {
    const provider = mockProvider();
    const logger = { warn: vi.fn() };
    const error = await createAiService([provider], { logger })
      .generateCase({ premise: 'A stolen trophy at a college cricket final', difficulty: 'easy' })
      .then(() => null, (e) => e);
    expect(error).toBeInstanceOf(TypeError);
    expect(error).not.toBeInstanceOf(AppError);
    expect(provider.calls).toHaveLength(1); // and it did not go round again or on to another provider
    expect(logger.warn).not.toHaveBeenCalled(); // it is not logged as a harmless provider hiccup
  });

  it('a backup provider is not tried for a bug of ours', async () => {
    const first = mockProvider({ name: 'first' });
    const second = mockProvider({ name: 'second' });
    await createAiService([first, second], { logger: { warn() {} } })
      .generateCase({ premise: 'A stolen trophy at a college cricket final', difficulty: 'easy' })
      .catch(() => {});
    expect(second.calls).toHaveLength(0);
  });
});
