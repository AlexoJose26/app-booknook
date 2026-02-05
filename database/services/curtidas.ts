// serviços de curtidas (mock)
export let curtidasMock: any[] = [];

export async function toggleCurtida(usuarioId: string, criticaId: number) {
  const index = curtidasMock.findIndex(
    c => c.usuario_id === usuarioId && c.critica_id === criticaId
  );

  if (index >= 0) {
    curtidasMock.splice(index, 1);
    return false;
  }

  curtidasMock.push({ usuario_id: usuarioId, critica_id: criticaId });
  return true;
}

export async function contarCurtidas(criticaId: number) {
  return curtidasMock.filter(c => c.critica_id === criticaId).length;
}
