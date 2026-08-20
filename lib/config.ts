import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";

/**
 * Every number that changes the app's personality lives here.
 * Tune these before you touch anything else.
 */

/** Reasoning model. Swap to anthropic("claude-opus-5") for harder questions. */
export const ANSWER_MODEL = anthropic("claude-sonnet-5");

/**
 * The second-pass verifier. Deliberately a MORE capable model than the answerer.
 *
 * Catching a claim that sounds supported but isn't is harder than writing the
 * answer was — and the verifier's output is short, so the stronger model costs
 * very little here. Using a different model also means its mistakes aren't
 * correlated with the answerer's, which is the whole point of a second opinion.
 */
export const VERIFIER_MODEL = anthropic("claude-opus-5");

/** Embedding model. Changing this means changing vector(1536) in the migration too. */
export const EMBEDDING_MODEL = openai.textEmbeddingModel("text-embedding-3-small");

/** Characters per chunk. Smaller = sharper citations, more noise. Larger = better context, vaguer cites. */
export const CHUNK_SIZE = 1400;

/** Characters repeated between neighbouring chunks, so a sentence split across a
 *  boundary still appears whole in at least one of them. */
export const CHUNK_OVERLAP = 200;

/** How many chunks to pull from the database per question. */
export const RETRIEVE_COUNT = 8;

/**
 * THE MOST IMPORTANT NUMBER IN THIS CODEBASE.
 *
 * Cosine similarity, 0 to 1. Anything below this is treated as "not in the
 * sources" and the model is never shown it.
 *
 * Too low and it answers from junk. Too high and it refuses things it actually
 * has. There is no correct value — there is only the value that is right for
 * YOUR documents, and you find it by testing questions you already know the
 * answers to.
 *
 * TODO(you): find your number. Start by logging every similarity score you see.
 */
export const SIMILARITY_FLOOR = 0.32;
