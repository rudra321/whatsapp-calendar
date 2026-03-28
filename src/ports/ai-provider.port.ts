import type { AIContext, ParsedIntent } from "../core/types.js";

export interface AIProviderPort {
  parseIntent(text: string, context?: AIContext): Promise<ParsedIntent>;
  generateResponse(prompt: string, context?: AIContext): Promise<string>;
}
