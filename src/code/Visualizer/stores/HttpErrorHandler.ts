
/**
 * HTTP Error Handler utility for processing API responses and extracting error messages
 */
export class HttpErrorHandler {
    /**
     * Handles HTTP responses and extracts error messages from API responses
     * @param response - The fetch Response object
     * @param context - Context for error messages (e.g., "updating event", "saving map")
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
                const specificErrors = errorBody.errors.map((err: any) => 
                    `${err.path}: ${err.msg}`
                ).join(', ');
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
     * Enhanced fetch wrapper that automatically handles errors
     */
    static async fetchWithErrorHandling(
        url: string, 
        options: RequestInit, 
        context: string
    ): Promise<any> {
        try {
            const response = await fetch(url, options);
            return await HttpErrorHandler.handleResponse(response, context);
        } catch (error) {
            if (error instanceof Error) {
                throw error; // Re-throw our formatted error
            } else {
                throw new Error(`Failed to ${context}: ${error}`);
            }
        }
    }
}
