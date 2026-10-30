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
    switchModeLink.textContent = 'Já tem uma conta? Entre';
  } else {
    authTitle.textContent = 'Entrar na Conta';
    authBtn.textContent = 'Entrar';
    nameFieldGroup.classList.add('hidden');
    switchModeLink.textContent = 'Cadastre-se';
  }
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const senha = document.getElementById('senha').value;
  const nome = document.getElementById('nome').value;

  const endpoint = isRegisterMode ? `${API_URL}/registrar` : `${API_URL}/login`;
  const payload = isRegisterMode ? { nome, email, senha } : { email, senha };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

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