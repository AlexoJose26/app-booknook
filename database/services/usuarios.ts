export let usuariosMock: any[] = [];

export async function atualizarFotoPerfil(usuarioId: string, fotoUri: string) {
  const usuario = usuariosMock.find(u => u.id === usuarioId);
  if (usuario) {
    usuario.foto_perfil = fotoUri;
  } else {
    usuariosMock.push({ id: usuarioId, foto_perfil: fotoUri });
  }
}

export async function buscarUsuarioPorNome(nome: string) {
  return usuariosMock.find(u => u.nome === nome) ?? null;
}

export async function criarUsuario(nome: string, senha: string) {
  const novo = { id: usuariosMock.length + 1, nome, senha, foto_perfil: "" };
  usuariosMock.push(novo);
  return novo;
}
