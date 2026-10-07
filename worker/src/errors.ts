export type ProviderName = 'anthropic' | 'openai';

/** The provider did not answer at all: bad key, no credit, rate limit, overload, outage, timeout or refusal. */
export class ProviderDown extends Error {
  readonly provider: ProviderName;
  readonly reason: string;

  constructor(provider: ProviderName, reason: string) {
    super(`${provider}: ${reason}`);
    this.provider = provider;
    this.reason = reason;
  }
}

/** The provider answered, but the answer cannot be used (for example it was cut off). Counts as invalid. */
export class InvalidAnswer extends Error {
  readonly provider: ProviderName;
  readonly reason: string;

  constructor(provider: ProviderName, reason: string) {
    super(`${provider}: ${reason}`);
    this.provider = provider;
    this.reason = reason;
  }
}
