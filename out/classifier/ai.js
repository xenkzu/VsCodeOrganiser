"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyWithAI = classifyWithAI;
const vscode = __importStar(require("vscode"));
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
];
// ── Secret scrubber ───────────────────────────────────────────
function scrubSecrets(code) {
    return code
        .replace(/(['"]?(?:api[_-]?key|secret|token|password|passwd|auth|bearer|credential)[s]?['"]?\s*[:=]\s*)['"]?[\w\-.\/+]{16,}['"]?/gi, '$1[REDACTED]')
        .replace(/\b(AKIA[0-9A-Z]{16})\b/g, '[AWS_KEY_REDACTED]')
        .replace(/\bghp_[A-Za-z0-9]{36}\b/g, '[GH_TOKEN_REDACTED]')
        .replace(/\bgho_[A-Za-z0-9]{36}\b/g, '[GH_TOKEN_REDACTED]')
        .replace(/\b[0-9a-f]{32,64}\b/gi, m => m.length >= 32 ? '[HEX_REDACTED]' : m);
}
// ── Response parser ───────────────────────────────────────────
function parseGroqResponse(raw) {
    const cleaned = raw.replace(/```(?:json)?/gi, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
        return null;
    }
    try {
        const parsed = JSON.parse(jsonMatch[0]);
        const topic = typeof parsed.topic === 'string' &&
            VALID_TOPICS.includes(parsed.topic)
            ? parsed.topic
            : 'Other';
        const subtopic = typeof parsed.subtopic === 'string'
            ? parsed.subtopic.trim().slice(0, 64)
            : '';
        const confidence = typeof parsed.confidence === 'number' &&
            parsed.confidence >= 0 &&
            parsed.confidence <= 1
            ? parsed.confidence
            : 0.5;
        return { topic, subtopic, confidence };
    }
    catch {
        return null;
    }
}
// ── Main export ───────────────────────────────────────────────
async function classifyWithAI(signal, outputChannel) {
    // Read settings
    const config = vscode.workspace.getConfiguration('nette');
    const aiEnabled = config.get('aiEnabled', true);
    const groqApiKey = config.get('groqApiKey', '').trim();
    if (!aiEnabled) {
        return null;
    }
    if (!groqApiKey) {
        promptForKeyOnce(outputChannel);
        return null;
    }
    // Never log the key — only log its length as a sanity check
    outputChannel.appendLine(`[Nette AI] Calling Groq (key length: ${groqApiKey.length})...`);
    const systemPrompt = `You are an expert DSA (Data Structures and Algorithms) code classifier.
Your job is to read code signals and return the correct topic category.
You MUST respond with ONLY a JSON object — no explanation, no markdown fences.
The topic field MUST be one of the valid topics listed by the user.
If the code is not DSA-related (e.g. basic I/O, OOP practice, utility code),
use the most appropriate non-DSA topic like OOP, Basic, or Pointers.`;
    const userPrompt = `Classify this code file into a DSA topic.

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
            outputChannel.appendLine(`[Nette AI] Groq returned HTTP ${response.status}`);
            return null;
        }
        const json = await response.json();
        const rawText = json?.choices?.[0]?.message?.content ?? '';
        if (!rawText) {
            outputChannel.appendLine('[Nette AI] Empty response from Groq');
            return null;
        }
        const parsed = parseGroqResponse(rawText);
        if (!parsed) {
            outputChannel.appendLine(`[Nette AI] Could not parse Groq response: ${rawText.slice(0, 120)}`);
            return null;
        }
        // Build targetPath using just the topic (no DSA/ prefix)
        // mover.ts will apply folderMap on top of this
        const targetPath = parsed.subtopic
            ? `${parsed.topic}/${parsed.subtopic}`
            : parsed.topic;
        outputChannel.appendLine(`[Nette AI] Result: ${parsed.topic}/${parsed.subtopic} ` +
            `(${Math.round(parsed.confidence * 100)}% confidence)`);
        return {
            topic: parsed.topic,
            subtopic: parsed.subtopic,
            confidence: parsed.confidence,
            source: 'ai',
            targetPath,
            userConfirmationRequired: false
        };
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('AbortError') || msg.includes('timed out')) {
            outputChannel.appendLine('[Nette AI] Request timed out after 10s');
        }
        else {
            outputChannel.appendLine(`[Nette AI] Error: ${msg}`);
        }
        return null;
    }
}
// ── Interactive configuration ────────────────────────────────
let hasPromptedThisSession = false;
async function promptForKeyOnce(outputChannel) {
    if (hasPromptedThisSession) {
        return;
    }
    hasPromptedThisSession = true;
    const btn = 'Set Groq API Key';
    const selection = await vscode.window.showWarningMessage('Nette: Groq AI classification is enabled but no API key is set.', btn);
    if (selection === btn) {
        const key = await vscode.window.showInputBox({
            title: 'Nette: Set Groq API Key',
            prompt: 'Paste your API key from console.groq.com (starts with gsk_)',
            placeHolder: 'gsk_...',
            ignoreFocusOut: true,
            password: true
        });
        if (key && key.trim().startsWith('gsk_')) {
            await vscode.workspace.getConfiguration('nette').update('groqApiKey', key.trim(), vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage('Nette: Groq API key saved successfully.');
        }
        else if (key) {
            vscode.window.showErrorMessage('Invalid Groq API key format. Should start with "gsk_".');
            hasPromptedThisSession = false; // allow retry
        }
        else {
            hasPromptedThisSession = false; // user cancelled, allow prompt again next file
        }
    }
}
