import * as vscode from 'vscode';
import { FileSignal, ClassificationResult } from '../types';

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.1-8b-instant';

// These must exactly match the folderMap keys in organizer.json
// so the AI result routes to the correct existing folder
const VALID_TOPICS = [
  'Trees',
  'LinkedLists',
  'Graphs',
  'DynamicProgramming',
  'Recursion',
  'Sorting',
  'Heap',
  'Backtracking',
  'Arrays',
  'Strings',
  'Stack',
  'Queue',
  'Pointers',
  'OOP',
  'Patterns',
  'Basic',
  'Other'
] as const;

type ValidTopic = typeof VALID_TOPICS[number];

// ── SecretStorage API ──────────────────────────────────────────
let _secrets: vscode.SecretStorage | null = null;

export function initSecretStorage(secrets: vscode.SecretStorage): void {
  _secrets = secrets;
}

// ── Secret scrubber ───────────────────────────────────────────
function scrubSecrets(code: string): string {
  return code
    .replace(
      /(['"]?(?:api[_-]?key|secret|token|password|passwd|auth|bearer|credential)[s]?['"]?\s*[:=]\s*)['"]?[\w\-.\/+]{16,}['"]?/gi,
      '$1[REDACTED]'
    )
    .replace(/\b(AKIA[0-9A-Z]{16})\b/g, '[AWS_KEY_REDACTED]')
    .replace(/\bghp_[A-Za-z0-9]{36}\b/g, '[GH_TOKEN_REDACTED]')
    .replace(/\bgho_[A-Za-z0-9]{36}\b/g, '[GH_TOKEN_REDACTED]')
    .replace(/\b[0-9a-f]{32,64}\b/gi, m =>
      m.length >= 32 ? '[HEX_REDACTED]' : m
    );
}

// ── Response parser ───────────────────────────────────────────
function parseGroqResponse(
  raw: string
): { topic: ValidTopic; subtopic: string; confidence: number } | null {

  const cleaned = raw.replace(/```(?:json)?/gi, '').trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*?\}/);
  if (!jsonMatch) { return null; }

  try {
    const parsed = JSON.parse(jsonMatch[0]);

    const topic: ValidTopic =
      typeof parsed.topic === 'string' &&
        VALID_TOPICS.includes(parsed.topic as ValidTopic)
        ? (parsed.topic as ValidTopic)
        : 'Other';

    const subtopic: string =
      typeof parsed.subtopic === 'string'
        ? parsed.subtopic.trim().slice(0, 64)
        : '';

    const confidence: number =
      typeof parsed.confidence === 'number' &&
        parsed.confidence >= 0 &&
        parsed.confidence <= 1
        ? parsed.confidence
        : 0.5;

    return { topic, subtopic, confidence };
  } catch {
    return null;
  }
}

// Module-level flag — resets when VS Code closes
let hasShownApiKeyWarning = false;

async function promptForApiKey(outputChannel: vscode.OutputChannel): Promise<void> {
  if (hasShownApiKeyWarning) { return; }
  hasShownApiKeyWarning = true;

  const choice = await vscode.window.showWarningMessage(
    'Nette: No Groq API key found. Enter your key now to enable AI classification.',
    'Enter Key',
    'Get Free Key',
    'Dismiss'
  );

  if (choice === 'Get Free Key') {
    await vscode.env.openExternal(vscode.Uri.parse('https://console.groq.com/keys'));
    // openExternal fully resolved — browser confirmation is gone
    // Give user a moment then prompt for the key
    await vscode.window.showInformationMessage(
      'Nette: Copy your API key from the browser, then click Continue.',
      { modal: true },
      'Continue'
    );

    const key = await vscode.window.showInputBox({
      title: 'Nette — Groq API Key',
      prompt: 'Paste your Groq API key here once you have copied it from the browser.',
      password: true,
      placeHolder: 'gsk_...',
      validateInput: (val) => {
        if (!val || val.trim().length < 10) {
          return 'Key looks too short — make sure you copied the full key';
        }
        return null;
      }
    });

    if (!key || !key.trim()) {
      // User dismissed without entering — reset flag so prompt shows again next save
      hasShownApiKeyWarning = false;
      return;
    }

    if (_secrets) {
      await _secrets.store('nette.groqApiKey', key.trim());
    }

    outputChannel.appendLine('[Nette AI] Groq API key saved via Get Free Key flow.');
    vscode.window.showInformationMessage(
      'Nette: Groq API key saved. Save a DSA file to test AI classification.'
    );
    return;
  }

  if (choice === 'Enter Key') {
    const key = await vscode.window.showInputBox({
      title: 'Nette — Groq API Key',
      prompt: 'Paste your Groq API key here. It will be saved securely.',
      password: true,           // masks the key like a password field
      placeHolder: 'gsk_...',
      validateInput: (val) => {
        if (!val || val.trim().length < 10) {
          return 'Key looks too short — make sure you copied the full key';
        }
        return null;
      }
    });

    if (!key || !key.trim()) {
      // User dismissed without entering — reset flag so prompt shows again next save
      hasShownApiKeyWarning = false;
      return;
    }

    if (_secrets) {
      await _secrets.store('nette.groqApiKey', key.trim());
    }

    outputChannel.appendLine('[Nette AI] Groq API key saved securely.');
    vscode.window.showInformationMessage(
      'Nette: Groq API key saved. AI classification is now active — save a DSA file to test it.'
    );
    return;
  }

  // If choice was Dismiss or undefined, we leave hasShownApiKeyWarning = true
  // so we don't nag the user every single save of that session.
}

// ── Main export ───────────────────────────────────────────────
export async function classifyWithAI(
  signal: FileSignal,
  outputChannel: vscode.OutputChannel
): Promise<ClassificationResult | null> {

  // Read settings
  const config = vscode.workspace.getConfiguration('nette');
  const aiEnabled = config.get<boolean>('aiEnabled', true);
  const groqApiKey = _secrets ? await _secrets.get('nette.groqApiKey') ?? '' : '';

  if (!aiEnabled) {
    return null;
  }

  if (!groqApiKey || groqApiKey.trim() === '') {
    promptForApiKey(outputChannel); // fire and forget — non-blocking
    outputChannel.appendLine('[Nette AI] API key missing, skipping AI this save.');
    return null;
  }

  // Never log the key — only log its length as a sanity check
  outputChannel.appendLine(
    `[Nette AI] Initializing Groq request (key length: ${groqApiKey.length}, model: ${GROQ_MODEL})...`
  );

  const systemPrompt =
    `You are an expert DSA (Data Structures and Algorithms) code classifier.
Your job is to read code signals and return the correct topic category.
You MUST respond with ONLY a JSON object — no explanation, no markdown fences.
The topic field MUST be one of the valid topics listed by the user.
If the code is not DSA-related (e.g. basic I/O, OOP practice, utility code),
use the most appropriate non-DSA topic like OOP, Basic, or Pointers.`;

  const userPrompt =
    `Classify this code file into a DSA topic.

Language: ${signal.language}
Class names: ${signal.classNames.join(', ') || 'none'}
Method names: ${signal.methodNames.join(', ') || 'none'}
Variable signals: ${signal.variableNames.join(', ') || 'none'}
Imports: ${signal.imports.join(', ') || 'none'}

Code (first 60 lines):
\`\`\`
${scrubSecrets(signal.rawSnippet)}
\`\`\`

Valid topics: ${VALID_TOPICS.join(', ')}

Respond with ONLY this JSON object:
{
  "topic": "<exactly one valid topic>",
  "subtopic": "<specific variant or empty string>",
  "confidence": <0.0 to 1.0>
}`;

  try {
    outputChannel.appendLine('[Nette AI] Sending fetch request to Groq API...');
    const response = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqApiKey}`
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 150,
        stream: false
      }),
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      // Never log the full response body — may contain key hints
      const errorText = await response.text();
      outputChannel.appendLine(
        `[Nette AI] Groq API error: ${response.status} ${response.statusText}. Response snippet: ${errorText.slice(0, 150)}`
      );
      return null;
    }

    const json = await response.json() as {
      choices?: Array<{
        message?: { content?: string }
      }>
    };

    const rawText = json?.choices?.[0]?.message?.content ?? '';
    if (!rawText) {
      outputChannel.appendLine('[Nette AI] Empty response from Groq');
      return null;
    }

    const parsed = parseGroqResponse(rawText);
    if (!parsed) {
      outputChannel.appendLine(
        `[Nette AI] Could not parse Groq response: ${rawText.slice(0, 120)}`
      );
      return null;
    }

    // Build targetPath using just the topic (no DSA/ prefix)
    // mover.ts will apply folderMap on top of this
    const targetPath = parsed.subtopic
      ? `${parsed.topic}/${parsed.subtopic}`
      : parsed.topic;

    outputChannel.appendLine(
      `[Nette AI] Result: ${parsed.topic}/${parsed.subtopic} ` +
      `(${Math.round(parsed.confidence * 100)}% confidence)`
    );

    return {
      topic: parsed.topic,
      subtopic: parsed.subtopic,
      confidence: parsed.confidence,
      source: 'ai',
      targetPath,
      userConfirmationRequired: false
    };

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('AbortError') || msg.includes('timed out')) {
      outputChannel.appendLine('[Nette AI] Request timed out after 10s');
    } else {
      outputChannel.appendLine(`[Nette AI] Error: ${msg}`);
    }
    return null;
  }
}
