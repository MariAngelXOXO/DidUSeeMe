const API_URL = 'http://localhost:3000/api/criancas';

const form = document.getElementById('child-form');
const idadeAtualInput = document.getElementById('idade_atual');
const idadeDesaparecimentoInput = document.getElementById('idade_desaparecimento');
const dataDesaparecimentoInput = document.getElementById('data_desaparecimento');

function atualizarValidacaoIdades() {
  const idadeAtual = idadeAtualInput.value;
  const idadeDesaparecimento = idadeDesaparecimentoInput.value;
  const idadeInvalida = idadeAtual !== '' && idadeDesaparecimento !== ''
    && Number(idadeDesaparecimento) > Number(idadeAtual);

  idadeDesaparecimentoInput.setCustomValidity(
    idadeInvalida ? 'A idade na época do desaparecimento não pode ser maior que a idade atual.' : ''
  );
}

function obterDataLocal() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const dia = String(hoje.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  if (!token) {
    alert('Você precisa estar logado para acessar esta página.');
    window.location.href = 'login.html';
    return;
  }

  dataDesaparecimentoInput.max = obterDataLocal();
});

idadeAtualInput.addEventListener('input', atualizarValidacaoIdades);
idadeDesaparecimentoInput.addEventListener('input', atualizarValidacaoIdades);

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const token = localStorage.getItem('token');
  if (!token) {
    alert('Você precisa estar logado para cadastrar um caso.');
    window.location.href = 'login.html';
    return;
  }

  atualizarValidacaoIdades();
  if (!form.reportValidity()) return;

  const payload = {
    nome: document.getElementById('nome').value.trim(),
    idade_atual: Number(idadeAtualInput.value),
    idade_desaparecimento: Number(idadeDesaparecimentoInput.value),
    cor_pele: document.getElementById('cor_pele').value,
    cabelo: document.getElementById('cabelo').value,
    olhos: document.getElementById('olhos').value,
    altura: document.getElementById('altura').value,
    roupas_desaparecimento: document.getElementById('roupas_desaparecimento').value,
    caracteristicas_marcantes: document.getElementById('caracteristicas_marcantes').value,
    familiares_proximos: document.getElementById('familiares_proximos').value,
    data_desaparecimento: dataDesaparecimentoInput.value,
    local_desaparecimento: document.getElementById('local_desaparecimento').value.trim(),
    ultimo_local_visto: document.getElementById('ultimo_local_visto').value,
    locais_testemunhas: document.getElementById('locais_testemunhas').value,
    informacoes_adicionais: document.getElementById('informacoes_adicionais').value,
  };

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    let data;
    try {
      data = await response.json();
    } catch (error) {
      console.error('Resposta inválida do servidor:', error);
      alert('O servidor retornou uma resposta inválida.');
      return;
    }

    if (!response.ok) {
      alert(data.erro || 'Erro ao salvar caso.');
      return;
    }

    alert('Caso catalogado com sucesso!');
    window.location.href = 'index.html';
  } catch (error) {
    console.error('Erro ao enviar:', error);
    alert('Erro de conexão com o servidor.');
  }
});
