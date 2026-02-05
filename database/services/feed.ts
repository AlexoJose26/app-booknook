// serviços de feed (mock)
export let feedMock: any[] = [];

export async function listarFeed() {
  return feedMock.sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
}

export async function criarFeedItem({
  usuario_id,
  acao,
  livro_titulo,
  critica_id,
}: {
  usuario_id: string;
  acao: string;
  livro_titulo?: string;
  critica_id?: number;
}) {
  feedMock.push({
    usuario_id,
    acao,
    livro_titulo,
    critica_id,
    createdAt: new Date().toISOString(),
  });
}
