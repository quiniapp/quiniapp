import { apiClient } from './apiClient';

export async function fetchWithAuth(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  return apiClient.fetchRaw(input, init);
}
