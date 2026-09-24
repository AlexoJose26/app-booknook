import { API_URL } from "./api";

export async function testarAPI() {
  try {
    const response = await fetch(`${API_URL}/health`);

    const data = await response.json();

    console.log("API MedeaSocial:", data);

    return data;
  } catch (error) {
    console.error("Erro ao conectar à API:", error);
    throw error;
  }
}
