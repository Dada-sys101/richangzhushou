export const AI_CONFIGURED_PROVIDERS = ["fake", "openai", "deepseek"] as const;

export type AiConfiguredProvider = (typeof AI_CONFIGURED_PROVIDERS)[number];

export interface AiProviderConfiguration {
  readonly selectedProvider: AiConfiguredProvider;
}

export type AiProviderConfigurationEnvironment = Readonly<
  Record<string, string | undefined>
>;

export class AiProviderConfigurationError extends Error {
  readonly category = "INVALID_PROVIDER_CONFIG";

  constructor() {
    super("AI provider configuration is invalid");
    this.name = "AiProviderConfigurationError";
  }
}

/**
 * Resolves only the server-side provider selection. Missing configuration is
 * intentionally safe-defaulted to Fake; an explicitly malformed value fails
 * closed and is never silently redirected to another provider.
 */
export function resolveAiProviderConfiguration(
  environment: AiProviderConfigurationEnvironment = process.env,
): AiProviderConfiguration {
  const configuredValue = environment.AI_PROVIDER;
  if (configuredValue === undefined) {
    return { selectedProvider: "fake" };
  }

  const selectedProvider = configuredValue.trim().toLowerCase();
  if (isAiConfiguredProvider(selectedProvider)) {
    return { selectedProvider };
  }
  throw new AiProviderConfigurationError();
}

function isAiConfiguredProvider(value: string): value is AiConfiguredProvider {
  return (AI_CONFIGURED_PROVIDERS as readonly string[]).includes(value);
}
