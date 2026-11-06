const API_URL = 'http://localhost:3000/api/criancas';

document.addEventListener('DOMContentLoaded', () => {
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

  if (token && usuario) {
    const saudacao = document.createElement('span');
    saudacao.append('Olá, ');
    const nome = document.createElement('strong');
    nome.textContent = usuario.nome;
    saudacao.appendChild(nome);
    navAuth.replaceChildren(saudacao, document.createTextNode(' | '));

    if (['admin', 'moderador', 'aprovador', 'publicador'].includes(usuario.perfil)) {
      const linkRevisao = document.createElement('a');
      linkRevisao.href = 'moderacao.html';
      linkRevisao.textContent = 'Revisar casos';
      navAuth.append(linkRevisao, document.createTextNode(' | '));
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
  } else {
    const linkEntrar = document.createElement('a');
    linkEntrar.href = 'login.html';
    linkEntrar.textContent = 'Entrar / Cadastrar-se';
    navAuth.replaceChildren(linkEntrar);
    if (btnNovoCaso) btnNovoCaso.classList.add('hidden');
  }
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
  window.location.reload();
}

async function carregarCasos() {
  const container = document.getElementById('cards-container');
  try {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error(`Falha ao carregar os casos (HTTP ${response.status}).`);
    }
    const criancas = await response.json();
    container.innerHTML = '';

    if (criancas.length === 0) {
      container.textContent = 'Nenhum caso publicado no momento.';
      return;
    }

    criancas.forEach(c => {
      const card = document.createElement('div');
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