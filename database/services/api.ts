export const API_URL = "https://apimideasocial.onrender.com";

export type UsuarioAPI = {
  id: string;
  nome: string;
  foto_perfil?: string | null;
  createdAt?: string;
};

export type LoginResponse = {
  success: boolean;
  token: string;
  expiresAt?: string;
  user: UsuarioAPI;
};

export type RegisterResponse = {
  success: boolean;
  message?: string;
  token?: string;
  expiresAt?: string;
  user?: UsuarioAPI;
};

export type SessionResponse = {
  success: boolean;
  message?: string;
  user: UsuarioAPI;
  session?: {
    expiresAt: string;
  };
};

export type AtualizarUsuarioResponse = {
  success: boolean;
  message?: string;
  user?: UsuarioAPI;
};

export type LogoutResponse = {
  success?: boolean;
  message?: string;
};

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const texto = await response.text();

  let data: unknown = null;

  try {
    data = texto ? JSON.parse(texto) : null;
  } catch {
    data = texto;
  }

  if (!response.ok) {
    let mensagem = `Erro HTTP ${response.status}`;

    if (
      typeof data === "object" &&
      data !== null &&
      "message" in data &&
      typeof (data as { message?: unknown }).message === "string"
    ) {
      mensagem = (data as { message: string }).message;
    } else if (
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof (data as { error?: unknown }).error === "string"
    ) {
      mensagem = (data as { error: string }).error;
    } else if (
      typeof data === "string" &&
      data.trim()
    ) {
      mensagem = data;
    }

    throw new Error(mensagem);
  }

  return data as T;
}

/**
 * LOGIN
 */
export async function loginUsuario(
  nome: string,
  senha: string,
): Promise<LoginResponse> {
  return request<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      nome: nome.trim(),
      senha,
    }),
  });
}

/**
 * REGISTO
 */
export async function registerUsuario(
  nome: string,
  senha: string,
): Promise<RegisterResponse> {
  return request<RegisterResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      nome: nome.trim(),
      senha,
    }),
  });
}

/**
 * OBTER UTILIZADOR DA SESSÃO ATUAL
 */
export async function obterUsuarioAtual(
  token: string,
): Promise<SessionResponse> {
  return request<SessionResponse>("/auth/me", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

/**
 * ATUALIZAR PERFIL
 */
export async function atualizarUsuarioAPI(
  token: string,
  id: string,
  nome: string,
  foto_perfil?: string | null,
): Promise<AtualizarUsuarioResponse> {
  return request<AtualizarUsuarioResponse>(`/usuarios/${id}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      nome: nome.trim(),
      foto_perfil: foto_perfil ?? null,
    }),
  });
}

/**
 * LOGOUT
 */
export async function logoutUsuario(
  token: string,
): Promise<LogoutResponse> {
  return request<LogoutResponse>("/auth/logout", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}
