import { z } from "zod";
import type { AIProviderPort } from "../../ports/ai-provider.port.js";
import type { AIContext, ParsedIntent, ConversationMessage } from "../../core/types.js";
import { IntentType } from "../../core/types.js";
import { AIParseError, RateLimitError } from "../../core/errors.js";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

const intentOutputSchema = z.object({
  type: z.nativeEnum(IntentType),
  confidence: z.number().min(0).max(1),
  parameters: z.record(z.unknown()),
});

export class GroqAdapter implements AIProviderPort {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async parseIntent(text: string, context?: AIContext): Promise<ParsedIntent> {
    const systemPrompt = this.buildParseSystemPrompt(context);
    const history = context?.conversationHistory ?? [];
    const response = await this.chat(systemPrompt, text, history, 0.1);

    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in response");

      const parsed = intentOutputSchema.parse(JSON.parse(jsonMatch[0]));
      return {
        ...parsed,
        rawText: text,
      };
    } catch (error) {
      throw new AIParseError(
        `Failed to parse AI response: ${response}`,
        error,
      );
    }
  }

  async generateResponse(prompt: string, context?: AIContext): Promise<string> {
    const systemPrompt =
      `You are a WhatsApp calendar assistant. You talk like a normal person on WhatsApp — not a bot, not a corporate assistant. ` +
      `Rules:\n` +
      `- Talk naturally like you would text a friend. Short, casual.\n` +
      `- NEVER use the same phrasing twice in a conversation. Vary everything.\n` +
      `- Don't over-explain. If the user asked to create an event and it worked, just confirm naturally.\n` +
      `- Don't add filler like "Sure!", "Of course!", "Happy to help!", "All set!"\n` +
      `- Match the user's energy — if they're brief, be brief. If they're chatty, be chatty.\n` +
      `- Use WhatsApp formatting (*bold*, _italic_) only when it genuinely helps readability.\n` +
      `- When listing events, keep it clean but not robotic.\n` +
      `- ALWAYS include ALL concrete data from [SYSTEM] messages: URLs, meet links, email addresses, attendee names, locations. The user can't see [SYSTEM] messages — if you don't include it, it's permanently lost and you won't be able to recall it later.\n` +
      `- NEVER fabricate or make up URLs, links, emails, or any data. If you don't have the exact info, say you don't know.\n` +
      `- If the user says thanks/ok/bye, just respond like a human would. Don't pitch your features.\n` +
      (context
        ? `Current date: ${context.currentDate}. Timezone: ${context.timezone}.`
        : "");

    const history = context?.conversationHistory ?? [];
    return this.chat(systemPrompt, prompt, history, 0.7);
  }

  private async chat(systemPrompt: string, userMessage: string, history: ConversationMessage[] = [], temperature = 0.7): Promise<string> {
    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: userMessage },
    ];

    const body = {
      model: this.model,
      messages,
      temperature,
      max_tokens: 1024,
    };

    const response = await this.fetchWithRetry(body);
    return response.choices[0]?.message?.content ?? "";
  }

  private async fetchWithRetry(body: unknown, retries = 1): Promise<any> {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (response.status === 429 && retries > 0) {
      const retryAfter = parseInt(response.headers.get("retry-after") ?? "2", 10);
      const delayMs = retryAfter * 1000;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return this.fetchWithRetry(body, retries - 1);
    }

    if (!response.ok) {
      const errorBody = await response.text();
      if (response.status === 429) {
        throw new RateLimitError("Groq rate limit exceeded", 2000);
      }
      throw new AIParseError(`Groq API error ${response.status}: ${errorBody}`);
    }

    return response.json();
  }

  private buildParseSystemPrompt(context?: AIContext): string {
    const dateInfo = context
      ? `Current date/time: ${context.currentDate}. Timezone: ${context.timezone}.`
      : "";

    return `You are a calendar intent parser. ${dateInfo}

Given a user message, determine the intent and extract parameters.
Respond with ONLY a JSON object (no other text):

{
  "type": "create_event" | "update_event" | "delete_event" | "list_events" | "daily_summary" | "unknown",
  "confidence": 0.0-1.0,
  "parameters": {
    // For create_event: { "title": string, "date": "YYYY-MM-DD", "startTime": "HH:mm", "endTime": "HH:mm" (optional, defaults to startTime + 1hr), "location": string (optional), "description": string (optional), "force": boolean (set true when user confirms they want to book despite conflicts), "attendees": string[] (optional, ONLY valid email addresses like "name@example.com" — if user mentions a person by NAME not email, put the name in the title instead e.g. "Meeting with Shivay") }
    // For update_event: { "searchQuery": string, "updates": { "title"?: string, "date"?: "YYYY-MM-DD", "startTime"?: "HH:mm", "endTime"?: "HH:mm", "location"?: string } }
    // For delete_event: { "searchQuery": string (optional, event title to match), "date": "YYYY-MM-DD" (optional, delete events on this date), "deleteAll": boolean (true if user wants to clear ALL events for a date) }
    // For list_events: { "date": "YYYY-MM-DD" (optional), "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD" }
    // For daily_summary: { "date": "YYYY-MM-DD" (defaults to today) }
    // For unknown: {}
  }
}

Interpret relative dates (tomorrow, next Friday, etc.) relative to the current date.
If the user wants to see their schedule, agenda, or asks "what's on my calendar", use list_events.
If the user says good morning, hi, or general greetings and mentions schedule, use daily_summary.

IMPORTANT: Use the conversation history to resolve references like "same time", "that event", "do it again", etc.
If the user refers to a time, date, title, or event from a previous message, extract those details into the parameters.

IMPORTANT: If the assistant previously warned about a conflict and the user responds with confirmation (yes, sure, proceed, book it, go ahead, do it, etc.), treat it as a create_event with "force": true. Extract the event details from the conversation history.

IMPORTANT: Messages like "thanks", "ok", "cool", "great", "bye", "no", "nah", "what?", "huh?" or other short acknowledgments/reactions are ALWAYS type "unknown" with confidence 0. Do NOT interpret them as calendar actions. Only classify as a calendar intent when the user clearly expresses intent to create, update, delete, or view events.`;
  }
}
