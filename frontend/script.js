const API_URL = 'http://localhost:3000/api/criancas';
let casosPublicados = [];
let casosPublicadosCarregados = false;

document.addEventListener('DOMContentLoaded', () => {
  const searchForm = document.getElementById('case-search-form');
  const searchInput = document.getElementById('case-search');
  searchForm.addEventListener('submit', event => {
    event.preventDefault();
    document.getElementById('casos').scrollIntoView({ behavior: 'smooth' });
    carregarCasos(searchInput.value);
  });
  searchInput.addEventListener('input', () => carregarCasos(searchInput.value));
  verificarAutenticacaoUI();
  carregarCasos();
});

function verificarAutenticacaoUI() {
  const token = localStorage.getItem('token');
  let usuario;
  try {
    usuario = JSON.parse(localStorage.getItem('usuario'));
  } catch (error) {
    usuario = null;
  }
  const navAuth = document.getElementById('nav-auth');
  const btnNovoCaso = document.getElementById('btn-novo-caso');
  const myCasesSection = document.getElementById('my-cases-section');

  if (token && usuario) {
    const saudacao = document.createElement('span');
    saudacao.append('Olá, ');
    const nome = document.createElement('strong');
    nome.textContent = usuario.nome;
    saudacao.appendChild(nome);
    navAuth.replaceChildren(saudacao);

    if (['admin', 'moderador', 'aprovador', 'publicador'].includes(usuario.perfil)) {
      const linkRevisao = document.createElement('a');
      linkRevisao.href = 'moderacao.html';
      linkRevisao.textContent = 'Revisar casos';
      navAuth.appendChild(linkRevisao);
    }

    const linkSair = document.createElement('a');
    linkSair.href = '#';
    linkSair.textContent = 'Sair';
    linkSair.addEventListener('click', event => {
      event.preventDefault();
      logout();
    });
    navAuth.appendChild(linkSair);
    if (btnNovoCaso) {
      btnNovoCaso.classList.toggle('hidden', !['admin', 'usuario'].includes(usuario.perfil));
    }
    if (myCasesSection) {
      myCasesSection.classList.remove('hidden');
      carregarMeusCasos(token);
    }
  } else {
    const linkEntrar = document.createElement('a');
    linkEntrar.href = 'login.html';
    linkEntrar.textContent = 'Entrar / Cadastrar-se';
    navAuth.replaceChildren(linkEntrar);
    if (btnNovoCaso) btnNovoCaso.classList.add('hidden');
    if (myCasesSection) myCasesSection.classList.add('hidden');
  }
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
  window.location.reload();
}

async function carregarMeusCasos(token) {
  const container = document.getElementById('my-cases-container');
  try {
    const response = await fetch(`${API_URL}/minhas`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const casos = await response.json();
    if (!response.ok) throw new Error(casos.erro || 'Não foi possível carregar seus casos.');

    container.replaceChildren();
    if (casos.length === 0) {
      container.textContent = 'Você ainda não cadastrou casos.';
      return;
    }

    casos.forEach(caso => {
      const card = document.createElement('article');
      card.className = 'card';
      const titulo = document.createElement('h3');
      titulo.textContent = caso.nome;
      card.appendChild(titulo);

      const status = document.createElement('p');
      status.textContent = `Status: ${caso.status}`;
      card.appendChild(status);

      if (['pending_review', 'rejected'].includes(caso.status)) {
        const editar = document.createElement('a');
        editar.className = 'btn';
        editar.href = `cadastrar.html?id=${encodeURIComponent(caso.id)}`;
        editar.textContent = 'Editar e reenviar';
        card.appendChild(editar);
      }

      const excluir = document.createElement('button');
      excluir.type = 'button';
      excluir.className = 'btn btn-danger';
      excluir.textContent = 'Excluir';
      excluir.addEventListener('click', () => excluirMeuCaso(caso.id, token));
      card.appendChild(excluir);
      container.appendChild(card);
    });
  } catch (error) {
    console.error('Erro ao carregar seus casos:', error);
    container.textContent = error.message || 'Não foi possível carregar seus casos.';
  }
}

async function excluirMeuCaso(id, token) {
  if (!window.confirm('Tem certeza que deseja excluir este caso?')) return;

  try {
    const response = await fetch(`${API_URL}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.erro || 'Não foi possível excluir o caso.');
    await carregarMeusCasos(token);
  } catch (error) {
    console.error('Erro ao excluir caso:', error);
    window.alert(error.message || 'Erro ao excluir o caso.');
  }
}

async function carregarCasos(termoBusca = '') {
  const container = document.getElementById('cards-container');
  try {
    if (!casosPublicadosCarregados) {
      const response = await fetch(API_URL);
      if (!response.ok) {
        throw new Error(`Falha ao carregar os casos (HTTP ${response.status}).`);
      }
      casosPublicados = await response.json();
      casosPublicadosCarregados = true;
    }

    const buscaNormalizada = termoBusca.trim().toLocaleLowerCase('pt-BR');
    const casosFiltrados = casosPublicados.filter(caso => {
      const camposBusca = [caso.nome, caso.local_desaparecimento, caso.idade_atual]
        .filter(valor => valor !== null && valor !== undefined)
        .join(' ')
        .toLocaleLowerCase('pt-BR');
      return camposBusca.includes(buscaNormalizada);
    });

    container.replaceChildren();
    if (casosFiltrados.length === 0) {
      container.textContent = casosPublicados.length === 0
        ? 'Nenhum caso publicado no momento.'
        : 'Nenhum caso corresponde à sua busca.';
      return;
    }

    casosFiltrados.forEach(c => {
      const card = document.createElement('article');
      card.className = 'card';

      const titulo = document.createElement('h3');
      titulo.textContent = c.nome;
      card.appendChild(titulo);

      const data = c.data_desaparecimento
        ? new Date(`${c.data_desaparecimento.slice(0, 10)}T00:00:00`)
        : null;
      const dataFormatada = data && !Number.isNaN(data.getTime())
        ? data.toLocaleDateString('pt-BR')
        : 'Data não informada';
      const linhas = [
        `Idade atual: ${c.idade_atual} anos (na época: ${c.idade_desaparecimento})`,
        `Desaparecimento: ${dataFormatada} em ${c.local_desaparecimento}`,
        `Características: cabelo ${c.cabelo || 'não informado'}, olhos ${c.olhos || 'não informados'}, altura ${c.altura || 'não informada'}`
      ];

      linhas.forEach(texto => {
        const paragrafo = document.createElement('p');
        paragrafo.textContent = texto;
        card.appendChild(paragrafo);
      });

      container.appendChild(card);
    });
  } catch (error) {
    console.error('Erro ao buscar lista de crianças:', error);
    container.textContent = 'Não foi possível carregar os casos. Tente novamente mais tarde.';
  }
}