const API_URL = 'http://localhost:3000/api/auth';
let isRegisterMode = false;

const form = document.getElementById('auth-form');
const authTitle = document.getElementById('auth-title');
const authBtn = document.getElementById('auth-btn');
const nameFieldGroup = document.getElementById('name-field-group');
const switchModeLink = document.getElementById('switch-mode');

switchModeLink.addEventListener('click', (e) => {
  e.preventDefault();
  isRegisterMode = !isRegisterMode;
  if (isRegisterMode) {
    authTitle.textContent = 'Criar uma Conta';
    authBtn.textContent = 'Cadastrar';
    nameFieldGroup.classList.remove('hidden');
    document.getElementById('nome').required = true;
    switchModeLink.textContent = 'Já tem uma conta? Entre';
  } else {
    authTitle.textContent = 'Entrar na Conta';
    authBtn.textContent = 'Entrar';
    nameFieldGroup.classList.add('hidden');
    document.getElementById('nome').required = false;
    switchModeLink.textContent = 'Cadastre-se';
  }
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value.trim();
  const senha = document.getElementById('senha').value;
  const nome = document.getElementById('nome').value.trim();

  if (isRegisterMode && (senha.length < 8 || new TextEncoder().encode(senha).length > 72)) {
    alert('A senha deve ter pelo menos 8 caracteres e no máximo 72 bytes.');
    return;
  }

  const endpoint = isRegisterMode ? `${API_URL}/registrar` : `${API_URL}/login`;
  const payload = isRegisterMode ? { nome, email, senha } : { email, senha };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      alert(data.erro || 'Ocorreu um erro.');
      return;
    }

    if (isRegisterMode) {
      alert('Cadastro realizado com sucesso! Faça login agora.');
      window.location.reload();
    } else {
      localStorage.setItem('token', data.token);
      localStorage.setItem('usuario', JSON.stringify(data.usuario));
      alert('Login efetuado com sucesso!');
      window.location.href = 'index.html';
    }
  } catch (error) {
    console.error('Erro na requisição:', error);
    alert('Erro de conexão com o servidor.');
  }
});