// serviços de comentários (mock)
export let comentariosMock: any[] = [];

export async function criarComentario(
  usuarioId: string,
  criticaId: number,
  texto: string
) {
  const novo = {
    id: comentariosMock.length + 1,
    usuario_id: usuarioId,
    critica_id: criticaId,
    texto,
    createdAt: new Date().toISOString(),
  };
  comentariosMock.push(novo);
  return novo;
}

export async function listarComentarios(criticaId: number) {
  return comentariosMock
    .filter(c => c.critica_id === criticaId)
    .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
}
