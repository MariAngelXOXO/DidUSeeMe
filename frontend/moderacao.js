const API_URL = 'http://localhost:3000/api/criancas';
const queue = document.getElementById('review-queue');
const token = localStorage.getItem('token');

let usuario;
try {
  usuario = JSON.parse(localStorage.getItem('usuario'));
} catch (error) {
  usuario = null;
}

if (!token || !usuario
  || !['admin', 'moderador', 'aprovador', 'publicador'].includes(usuario.perfil)) {
  alert('Acesso restrito à equipe de revisão.');
  window.location.href = 'index.html';
} else {
  carregarFila();
}

function adicionarCampo(card, label, value) {
  const linha = document.createElement('p');
  const titulo = document.createElement('strong');
  titulo.textContent = `${label}: `;
  linha.append(titulo, document.createTextNode(value || 'Não informado'));
  card.appendChild(linha);
}

function criarBotao(texto, acao) {
  const botao = document.createElement('button');
  botao.type = 'button';
  botao.className = 'btn';
  botao.textContent = texto;
  botao.addEventListener('click', acao);
  return botao;
}

async function carregarFila() {
  queue.textContent = 'Carregando casos para revisão...';

  try {
    const response = await fetch(`${API_URL}/revisao`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.erro || 'Não foi possível carregar a fila.');

    queue.replaceChildren();
    if (data.length === 0) {
      queue.textContent = 'Não há casos aguardando revisão, aprovação ou publicação.';
      return;
    }

    data.forEach(caso => {
      const card = document.createElement('article');
      card.className = 'card';
      const titulo = document.createElement('h3');
      titulo.textContent = caso.nome;
      card.appendChild(titulo);
      adicionarCampo(card, 'Status', caso.status);
      adicionarCampo(card, 'Fonte', `${caso.fonte_tipo}: ${caso.fonte_referencia}`);
      adicionarCampo(card, 'Autorização confirmada', caso.dados_autorizados ? 'Sim' : 'Não');
      adicionarCampo(card, 'Informações de familiares (restritas)', caso.familiares_proximos);
      adicionarCampo(card, 'Último local visto (restrito)', caso.ultimo_local_visto);
      adicionarCampo(card, 'Relato de testemunhas (restrito)', caso.locais_testemunhas);
      adicionarCampo(card, 'Informações adicionais (restritas)', caso.informacoes_adicionais);

      if (['admin', 'moderador'].includes(usuario.perfil)
        && !['published', 'rejected'].includes(caso.status)) {
        card.appendChild(criarBotao(
          'Registrar / revisar fonte',
          () => atualizarFonte(caso.id, caso.fonte_tipo, caso.fonte_referencia)
        ));
      }
      if (caso.status === 'pending_review' && ['admin', 'moderador'].includes(usuario.perfil)) {
        card.appendChild(criarBotao('Iniciar revisão', () => executarAcao(caso.id, 'revisar')));
      }
      if (caso.status === 'in_review') {
        if (['admin', 'aprovador'].includes(usuario.perfil)) {
          card.appendChild(criarBotao('Aprovar', () => executarAcao(caso.id, 'aprovar')));
        }
        if (['admin', 'moderador', 'aprovador'].includes(usuario.perfil)) {
          card.appendChild(criarBotao('Reprovar', () => reprovar(caso.id)));
        }
      }
      if (caso.status === 'approved' && ['admin', 'publicador'].includes(usuario.perfil)) {
        card.appendChild(criarBotao('Publicar', () => executarAcao(caso.id, 'publicar')));
      }
      queue.appendChild(card);
    });
  } catch (error) {
    console.error('Erro ao carregar fila de revisão:', error);
    queue.textContent = error.message || 'Erro ao carregar os casos.';
  }
}

async function executarAcao(id, acao, body) {
  try {
    const response = await fetch(`${API_URL}/${id}/${acao}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.erro || 'Não foi possível atualizar o caso.');
    await carregarFila();
  } catch (error) {
    console.error('Erro ao atualizar caso:', error);
    alert(error.message || 'Erro ao atualizar o caso.');
  }
}

function reprovar(id) {
  const observacao = window.prompt('Informe o motivo da reprovação:');
  if (observacao === null) return;
  executarAcao(id, 'reprovar', { observacao });
}

async function atualizarFonte(id, tipoAtual, referenciaAtual) {
  const fonte_tipo = window.prompt('Tipo de fonte: oficial ou autorizada', tipoAtual || 'oficial');
  if (fonte_tipo === null) return;
  const fonte_referencia = window.prompt('Referência da fonte verificada', referenciaAtual || '');
  if (fonte_referencia === null) return;
  if (!window.confirm('Confirma que a fonte foi verificada e que os dados têm autorização para divulgação?')) {
    return;
  }
  await executarAtualizacaoFonte(id, {
    fonte_tipo: fonte_tipo.trim().toLowerCase(),
    fonte_referencia: fonte_referencia.trim(),
    dados_autorizados: true
  });
}

async function executarAtualizacaoFonte(id, body) {
  try {
    const response = await fetch(`${API_URL}/${id}/fonte`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.erro || 'Não foi possível registrar a fonte.');
    alert(data.mensagem);
    await carregarFila();
  } catch (error) {
    console.error('Erro ao registrar fonte:', error);
    alert(error.message || 'Erro ao registrar a fonte.');
  }
}
