import { IntentType, type IntentHandler } from "../core/types.js";

export const unknownHandler: IntentHandler = {
  intentType: IntentType.UNKNOWN,

  async execute({ intent, ports, aiContext }) {
    ports.logger.debug("Unknown intent", { rawText: intent.rawText });

    const responseText = await ports.ai.generateResponse(
      `[SYSTEM: not a calendar request] User said: "${intent.rawText}"`,
      aiContext,
    );

    return { responseText };
  },
};
