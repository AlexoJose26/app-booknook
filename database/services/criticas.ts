export let criticasMock: any[] = [];
export let feedMock: any[] = [];

export async function criarCritica(
  usuario_id: string,
  livro_id: string,
  texto: string,
  nota?: number
) {
  const nova = {
    id: criticasMock.length + 1,
    usuario_id,
    livro_id,
    texto,
    nota: nota ?? null,
    createdAt: new Date().toISOString(),
  };
  criticasMock.push(nova);

  const livroTitulo = "Livro"; 

  feedMock.push({
    usuario_id,
    acao: "publicou uma crítica",
    livro_titulo: livroTitulo,
    data: nova.createdAt,
  });

  return nova;
}

export async function listarCriticas(livro_id: string) {
  return criticasMock
    .filter(c => c.livro_id === livro_id)
    .map(c => ({
      id: c.id,
      texto: c.texto,
      nota: c.nota,
      createdAt: c.createdAt,
      nome: "Usuário Mock",
      foto_perfil: "https://via.placeholder.com/150",
    }))
    .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
}
