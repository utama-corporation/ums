import { ApiResponse } from "@ums/contracts";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5500/api/v1";

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const defaultHeaders: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const config: RequestInit = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
    credentials: "include", // Send and receive HttpOnly cookies
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    const data = (await response.json()) as ApiResponse<T>;

    if (!response.ok && !data.error) {
      return {
        success: false,
        error: {
          code: "HTTP_ERROR",
          message: `HTTP Error ${response.status}: ${response.statusText}`,
        },
      };
    }

    return data;
  } catch (error) {
    return {
      success: false,
      error: {
        code: "NETWORK_ERROR",
        message: error instanceof Error ? error.message : "Failed to fetch from API",
      },
    };
  }
}
