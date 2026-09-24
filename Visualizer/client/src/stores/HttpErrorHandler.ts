/**
 * HTTP Error Handler utility for processing API responses and extracting error messages
 */
export class HttpErrorHandler {
    /**
     * Handles HTTP responses and extracts error messages from API responses
     * @param response - The fetch Response object
     * @param context - Context for error messages (e.g., "updating chapter", "saving map")
     * @returns The parsed JSON response if successful
     * @throws Error with detailed message if the request failed
     */
    static async handleResponse<T = any>(response: Response, context: string): Promise<T> {
        if (response.ok) {
            try {
                return await response.json();
            } catch (parseError) {
                // Some endpoints might return empty responses on success
                return {} as T;
            }
        }

        let errorMessage = `Failed to ${context}`;

        try {
            // Try to parse the error response body
            const errorBody = await response.json();
            console.log('Error response body:', errorBody); // Debug log

            // Extract and log specific error messages for easier debugging
            if (errorBody.errors && Array.isArray(errorBody.errors)) {
                const specificErrors = errorBody.errors.map((err: any) => `${err.path}: ${err.msg}`).join(', ');
                console.error(`🔴 Validation Errors: ${specificErrors}`);
                errorMessage = `${errorMessage}: ${specificErrors}`;
            } else if (errorBody.error) {
                console.error(`🔴 Error: ${errorBody.error}`);
                errorMessage = `${errorMessage}: ${errorBody.error}`;
            } else if (errorBody.message) {
                console.error(`🔴 Error: ${errorBody.message}`);
                errorMessage = `${errorMessage}: ${errorBody.message}`;
            } else if (errorBody.status === 'error' && errorBody.message) {
                // Handle old format during transition
                console.error(`🔴 Error: ${errorBody.message}`);
                errorMessage = `${errorMessage}: ${errorBody.message}`;
            } else if (typeof errorBody === 'string') {
                console.error(`🔴 Error: ${errorBody}`);
                errorMessage = `${errorMessage}: ${errorBody}`;
            } else {
                console.error(`🔴 HTTP Error: ${response.status} ${response.statusText}`);
                errorMessage = `${errorMessage}: ${response.status} ${response.statusText}`;
            }
        } catch (parseError) {
            // If we can't parse the response body, fall back to status info
            console.log('Failed to parse error response:', parseError);
            errorMessage = `${errorMessage}: ${response.status} ${response.statusText}`;
        }

        throw new Error(errorMessage);
    }

    /**
     * A `fetch` that tolerates the dev server restarting underneath it.
     *
     * The Visualizer server imports `@story/data`, so every file it writes is in its own module
     * graph and `node --watch` restarts it after each save. That restart is *wanted* — it is how
     * the read model picks the new value up — but it means a request in flight during a save can
     * fail at the socket, which the author sees as an error toast for a save that worked.
     *
     * So a request whose `fetch` rejects outright is retried once, after a short pause. Two
     * deliberate limits: only a **network-level** failure is retried (an HTTP error status is a
     * real answer and is passed straight through), and only a **GET** (every other method is a
     * write, and replaying a write that may have landed is worse than reporting it).
     */
    private static async fetchSurvivingRestart(url: string, options: RequestInit): Promise<Response> {
        try {
            return await fetch(url, options);
        } catch (error) {
            const method = (options.method ?? 'GET').toUpperCase();
            if (method !== 'GET') throw error;

            await new Promise((resolve) => setTimeout(resolve, 400));
            return await fetch(url, options);
        }
    }

    /**
     * Enhanced fetch wrapper that automatically handles errors.
     *
     * Generic in the response type so callers can say what they expect rather than casting an
     * `any` at every call site — the `Agent` reads are all typed against the server's own wire
     * types, and that only works if the response type survives this call.
     */
    static async fetchWithErrorHandling<T = unknown>(url: string, options: RequestInit, context: string): Promise<T> {
        try {
            const response = await HttpErrorHandler.fetchSurvivingRestart(url, options);
            return await HttpErrorHandler.handleResponse<T>(response, context);
        } catch (error) {
            if (error instanceof Error) {
                throw error; // Re-throw our formatted error
            } else {
                throw new Error(`Failed to ${context}: ${error}`);
            }
        }
    }
}
