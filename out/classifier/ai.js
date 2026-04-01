"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyAI = classifyAI;
function scrubSecrets(code) {
    return code
        // Generic API key patterns (long alphanumeric strings after = or :)
        .replace(/(['"]?(?:api[_-]?key|secret|token|password|passwd|auth|bearer|credential)[s]?['"]?\s*[:=]\s*)['"]?[\w\-./+]{16,}['"]?/gi, '$1[REDACTED]')
        // AWS access key pattern
        .replace(/\b(AKIA[0-9A-Z]{16})\b/g, '[AWS_KEY_REDACTED]')
        // AWS secret pattern
        .replace(/\b([A-Za-z0-9/+=]{40})\b/g, (match) => {
        // Only redact if it looks like base64 and is exactly 40 chars
        return match.length === 40 && /[+/=]/.test(match)
            ? '[AWS_SECRET_REDACTED]'
            : match;
    })
        // GitHub tokens
        .replace(/\bghp_[A-Za-z0-9]{36}\b/g, '[GH_TOKEN_REDACTED]')
        .replace(/\bgho_[A-Za-z0-9]{36}\b/g, '[GH_TOKEN_REDACTED]')
        // Generic long hex strings (possible secrets)
        .replace(/\b[0-9a-f]{32,64}\b/gi, (match) => match.length >= 32 ? '[HEX_REDACTED]' : match);
}
async function classifyAI(signal, endpoint, outputChannel) {
    if (!endpoint) {
        return null;
    }
    // Validate the endpoint URL
    let parsedUrl;
    try {
        parsedUrl = new URL(endpoint);
    }
    catch {
        outputChannel.appendLine('AI classifier skipped: invalid endpoint URL');
        return null;
    }
    // Only allow HTTPS (never HTTP, file://, data:, or internal protocols)
    if (parsedUrl.protocol !== 'https:') {
        outputChannel.appendLine('AI classifier skipped: endpoint must use HTTPS');
        return null;
    }
    // Block private/internal IP ranges (SSRF protection)
    const hostname = parsedUrl.hostname.toLowerCase();
    const blockedPatterns = [
        /^localhost$/,
        /^127\./,
        /^10\./,
        /^172\.(1[6-9]|2\d|3[01])\./,
        /^192\.168\./,
        /^::1$/,
        /^0\.0\.0\.0$/,
        /^169\.254\./, // link-local
        /^fc00:/, // IPv6 ULA
        /^fe80:/, // IPv6 link-local
    ];
    const isBlocked = blockedPatterns.some(p => p.test(hostname));
    if (isBlocked) {
        outputChannel.appendLine('AI classifier skipped: endpoint resolves to a private/internal address');
        return null;
    }
    const prompt = `
    Analyze this code and classify it into a DSA topic.
    Code snippet (first 60 lines):
    ${scrubSecrets(signal.rawSnippet)}
  `;
    // Empty stub for the actual AI call
    return {
        topic: 'Uncategorized',
        subtopic: 'Miscellaneous',
        confidence: 0,
        source: 'ai',
        targetPath: '',
        userConfirmationRequired: false
    };
}
