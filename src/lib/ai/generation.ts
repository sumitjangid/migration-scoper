import { NoObjectGeneratedError } from "ai";
import { ZodError } from "zod";

type Generator<T> = (prompt: string) => Promise<T>;

export async function generateValidatedOutput<T>(
  generate: Generator<T>,
  prompt: string,
  isValid: (output: T) => boolean,
  validationMessage: string,
): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let output: T;
    try {
      const retryPrompt = attempt === 0
        ? prompt
        : `${prompt}\n\nYour previous response failed validation. Follow the output schema exactly and copy evidence fields verbatim.`;
      output = await generate(retryPrompt);
    } catch (error) {
      if (attempt === 0 && (NoObjectGeneratedError.isInstance(error) || error instanceof ZodError)) {
        continue;
      }
      throw error;
    }

    if (isValid(output)) return output;
    if (attempt === 1) throw new Error(validationMessage);
  }

  throw new Error(validationMessage);
}
