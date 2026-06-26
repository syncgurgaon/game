import axios from "axios";

export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

export function buildWsUrl(code, playerId) {
  // REACT_APP_BACKEND_URL is https://... -> wss://...
  const httpUrl = BACKEND_URL.replace(/\/$/, "");
  const wsUrl = httpUrl.replace(/^http/, "ws");
  return `${wsUrl}/api/ws/${code}/${playerId}`;
}
