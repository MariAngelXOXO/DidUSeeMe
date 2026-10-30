const API_URL = 'http://localhost:3000/api/criancas';

document.addEventListener('DOMContentLoaded', () => {
  verificarAutenticacaoUI();
  carregarCasos();
});

function verificarAutenticacaoUI() {
  const token = localStorage.getItem('token');
  const usuario = JSON.parse(localStorage.getItem('usuario'));
  const navAuth = document.getElementById('nav-auth');
  const btnNovoCaso = document.getElementById('btn-novo-caso');

  if (token && usuario) {
    navAuth.innerHTML = `<span>Olá, <strong>${usuario.nome}</strong></span> | <a href="#" onclick="logout()">Sair</a>`;
    if (btnNovoCaso) btnNovoCaso.classList.remove('hidden');
  } else {
    navAuth.innerHTML = `<a href="login.html">Entrar / Cadastrar-se</a>`;
    if (btnNovoCaso) btnNovoCaso.classList.add('hidden');
  }
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
  window.location.reload();
}

async function carregarCasos() {
  try {
    const response = await fetch(API_URL);
    const criancas = await response.json();

    const container = document.getElementById('cards-container');
    container.innerHTML = '';

    if (criancas.length === 0) {
      container.innerHTML = '<p>Nenhum caso cadastrado no momento.</p>';
      return;
    }

    criancas.forEach(c => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <h3>${c.nome}</h3>
        <p><strong>Idade Atual:</strong> ${c.idade_atual} anos (Na época: ${c.idade_desaparecimento})</p>
        <p><strong>Desaparecido(a) em:</strong> ${new Date(c.data_desaparecimento).toLocaleDateString('pt-BR')} em ${c.local_desaparecimento}</p>
        <p><strong>Características:</strong> Cabelo ${c.cabelo || 'N/I'}, Olhos ${c.olhos || 'N/I'}, Altura ${c.altura || 'N/I'}</p>
        <p><strong>Último local visto:</strong> ${c.ultimo_local_visto || 'Não informado'}</p>
        <p><strong>Testemunhas:</strong> ${c.locais_testemunhas || 'Nenhuma informação adicional'}</p>
      `;
      container.appendChild(card);
    });
  } catch (error) {
    console.error('Erro ao buscar lista de crianças:', error);
  }
}