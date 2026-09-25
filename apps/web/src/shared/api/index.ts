// В apps/web резолвинг — bundler, поэтому импорты без расширения.
// Правило `.js` из apps/api и contracts (nodenext) сюда не распространяется.
export { apiFetch, ApiError, NetworkError } from "./client";
