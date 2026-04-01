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
exports.mergeResults = mergeResults;
const vscode = __importStar(require("vscode"));
const ai_1 = require("./classifier/ai");
async function mergeResults(heuristic, rule, signal, outputChannel) {
    // Rules always win
    if (rule) {
        return { ...rule, confidence: 1.0, userConfirmationRequired: false };
    }
    const config = vscode.workspace.getConfiguration('nette');
    const threshold = config.get('confidenceThreshold', 0.75);
    const topHeuristic = heuristic.length > 0 ? heuristic[0] : null;
    // If heuristic is low confidence OR empty, trigger AI fallback
    if (!topHeuristic || topHeuristic.confidence < threshold) {
        const aiResult = await (0, ai_1.classifyWithAI)(signal, outputChannel);
        if (aiResult) {
            return aiResult;
        }
        // AI unavailable or failed
        if (topHeuristic) {
            // Return low-confidence heuristic with confirmation flag
            return { ...topHeuristic, userConfirmationRequired: true };
        }
        // Nothing from heuristic, nothing from AI -> manual choice required
        return null;
    }
    // High confidence heuristic
    return { ...topHeuristic, userConfirmationRequired: false };
}
