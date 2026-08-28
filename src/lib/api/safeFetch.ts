/**
 * Safe JSON Response Parser Helper
 * Checks response.ok and Content-Type before invoking .json().
 * Prevents "Unexpected token 'R', Request Entity Too Large is not valid JSON" crashes
 * by gracefully reading non-JSON text errors (413 Payload Too Large, 500 HTML pages, etc.).
 */
export async function safeParseJsonResponse<T = any>(
  res: Response
): Promise<{ success: boolean; data?: T; error?: string }> {
  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  if (!res.ok) {
    if (res.status === 413) {
      return {
        success: false,
        error: 'Payload Too Large (413): Request body size exceeds serverless function limit (4.5MB). Uploading audio directly to storage...',
      };
    }

    if (isJson) {
      try {
        const errJson = await res.json();
        return {
          success: false,
          error: errJson.error || errJson.message || `Request failed with status code ${res.status}`,
        };
      } catch {
        // Fallback to text parsing if JSON fails
      }
    }

    const text = await res.text().catch(() => '');
    const cleanText = text.replace(/<[^>]*>/g, '').trim().slice(0, 250) || `Server error (${res.status})`;
    return {
      success: false,
      error: `API Request Failed (${res.status}): ${cleanText}`,
    };
  }

  if (!isJson) {
    const text = await res.text().catch(() => '');
    const cleanText = text.replace(/<[^>]*>/g, '').trim().slice(0, 150);
    return {
      success: false,
      error: `Server returned non-JSON response (${contentType || 'text/html'}): ${cleanText}`,
    };
  }

  try {
    const data = await res.json();
    return { success: true, data };
  } catch (err: any) {
    return {
      success: false,
      error: `Failed to parse response JSON: ${err.message || 'Malformed JSON format'}`,
    };
  }
}
