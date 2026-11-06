# DidUSeeMe
O desaparecimento de crianças é um grave problema social no Brasil, que causa angústia e insegurança para inúmeras famílias. A falta de informações centralizadas e de fácil acesso pode dificultar a divulgação dos casos e o compartilhamento de informações importantes para a localização das crianças desaparecidas.
Muitas vezes, informações como características físicas, data do desaparecimento e local onde a criança foi vista pela última vez ficam dispersas em diferentes canais de comunicação, dificultando que essas informações alcancem pessoas que possam contribuir para encontrá-las.
Esse problema afeta envolvidos na resolução do caso de desaparecimento, pois caso a criança tenha sido vista, a informação não será passada para quem está resolvendo o problema, pois a pessoa não tem conhecimento de que aquela criança está desaparecida. Se essa pessoa soubesse e tivesse as características da criança, poderia ajudar a polícia a encontrá-la, fornecendo informações de onde a viu e com quem a viu.
Com o caso sendo resolvido, as famílias recebem respostas e encontram seus filhos, netos e irmãos mais rápido, o que é bom, já que em casos de desaparecimento, quanto mais tempo o caso leva para ser resolvido, menos chances da pessoa ser encontrada com vida, principalmente crianças.
O projeto tem como objetivo desenvolver um site para catalogar e divulgar informações sobre crianças desaparecidas no Brasil, reunindo em um único ambiente os dados relevantes de cada caso.
A plataforma permitirá organizar informações como:
Nome da criança: identificação conforme os registros autorizados.
Idade: idade atual e idade na época do desaparecimento.
Descrição física: Cor de pele, comprimento e cor do cabelo, cor dos olhos, altura, roupas que usava no dia do desaparecimento.
Características marcantes: Cicatrizes, marcas de nascença, deficiência física.
Familiares próximos: Pai, mãe, avós, tios familiares próximos da vítima.
Data do desaparecimento: quando o caso foi registrado.
Local do desaparecimento: cidade e estado onde ocorreu.
Último local onde foi vista (com mapa demarcando o local): informações disponíveis sobre o último avistamento com mapa integrado demarcando raio de 100 metros onde foi o último avistamento.
Locais onde pessoas a viram: no mapa, haverá também pontos onde a criança foi vista após o desaparecimento de acordo com testemunhas.
Informações adicionais: características de suspeitos não identificados, itens que estavam com a criança no dia do desaparecimento, contexto.
	Logo abaixo, terá o número da polícia, para caso tenha informações sobre, poder ligar e ajudar.
Tem como objetivo facilitar o acesso e a divulgação de informações sobre crianças desaparecidas, contribuindo para ampliar o alcance dos casos e incentivar a colaboração da sociedade na busca por informações que possam ajudar na localização dessas crianças.
A iniciativa busca utilizar a tecnologia como ferramenta de apoio à sociedade, promovendo a conscientização sobre o desaparecimento infantil e tornando as informações mais organizadas e acessíveis, possibilitando que o caso tenha toda a ajuda e reconhecimento possível.
A plataforma deverá priorizar a segurança das crianças e de suas famílias, utilizando informações provenientes de fontes oficiais ou devidamente autorizadas. Dados pessoais sensíveis, endereços residenciais e informações que possam colocar a criança em risco não deverão ser divulgados. O site terá caráter informativo e não substituirá o trabalho das autoridades responsáveis pelas investigações, embora vise possibilitar apoio da sociedade no caso.
Mais informação, mais conscientização e mais possibilidades de ajudar, juntos somos mais fortes.

## Configuração do banco de dados

1. Abra `backend/database/schema.sql` no MySQL Workbench e execute o script completo.
2. O script seleciona o banco `diduseeme_db`, cria as tabelas necessárias e insere os perfis `admin`, `moderador`, `aprovador`, `publicador` e `usuario`.
3. Configure as variáveis de conexão do MySQL e `JWT_SECRET` no ambiente do backend antes de iniciar o servidor.
4. Cadastre usuários pela rota `/api/auth/registrar`; novos usuários recebem o perfil `usuario`.

O script pode ser executado novamente sem apagar os dados. `CREATE TABLE IF NOT EXISTS` não recria nem corrige automaticamente tabelas já existentes; o script inclui migrações para `perfil_id` e `ativo` em `usuarios`, e para status, fonte, autorização e `usuario_id` em `criancas_desaparecidas`. Casos antigos são enviados para revisão, não publicados automaticamente; os que não têm dono permanecem sem vínculo e não são apagados. Não use `DROP DATABASE` para corrigir erros sem antes fazer backup.

Cada usuário pode excluir os próprios casos; somente `admin` pode excluir qualquer caso. Para atribuir um perfil de equipe, altere `usuarios.perfil_id` para o ID correto em `perfis`; faça isso apenas para contas autorizadas.

## API: excluir um caso

Para excluir um caso, envie uma requisição `DELETE` para `/api/criancas/:id`, substituindo `:id` pelo ID retornado ao cadastrar o caso. A rota exige um token de login; usuários podem excluir apenas os próprios casos, enquanto administradores podem excluir qualquer caso.

No Postman:

1. Selecione o método `DELETE` e informe, por exemplo, `http://localhost:3000/api/criancas/12`.
2. Em **Authorization**, escolha **Bearer Token** e cole o token obtido em `/api/auth/login`.
3. Envie a requisição sem corpo.

Uma exclusão bem-sucedida responde com HTTP `200`. Um ID inválido responde com `400`; um caso inexistente ou sem permissão para o usuário responde com `404`. O banco precisa ter a coluna `usuario_id` em `criancas_desaparecidas`, relacionada a `usuarios.id`; os novos cadastros são associados automaticamente ao usuário autenticado. Após alterar o perfil de uma conta, faça login novamente para obter um token JWT atualizado.

## Revisão, aprovação e publicação

Novos casos são criados com status `pending_review` e não aparecem na listagem pública. O cadastro exige a categoria e a referência da fonte, além da confirmação de autorização para divulgar os dados.

- `usuario` pode cadastrar e excluir os próprios casos; os perfis de equipe são atribuídos manualmente por um administrador autorizado.
- `moderador` inicia a revisão (`POST /api/criancas/:id/revisar`) e pode reprovar com motivo (`POST /api/criancas/:id/reprovar`, com `{ "observacao": "motivo" }`).
- `aprovador` aprova casos em revisão (`POST /api/criancas/:id/aprovar`) e pode reprová-los (`POST /api/criancas/:id/reprovar`).
- `publicador` publica casos aprovados (`POST /api/criancas/:id/publicar`); apenas então aparecem em `GET /api/criancas`.
- `admin` pode executar todas as etapas. Os perfis de equipe podem consultar `GET /api/criancas/revisao`; a página `frontend/moderacao.html` oferece uma interface para a fila.
- `moderador` ou `admin` pode registrar ou corrigir a fonte verificada com `PUT /api/criancas/:id/fonte`, enviando `fonte_tipo`, `fonte_referencia` e `dados_autorizados: true`. Isso permite revisar casos antigos migrados sem fonte. Se o caso já estava aprovado, a alteração o devolve para revisão.
- As transições são registradas em `historico_status_casos`; ações fora de ordem retornam HTTP `409`.

Todas as rotas protegidas exigem o token JWT como Bearer. Os campos sobre familiares, testemunhas, último local e informações adicionais ficam restritos à fila de revisão e não são retornados na listagem pública. Mesmo na revisão, não registre endereços residenciais, contatos ou acusações não verificadas. O formulário e a API exigem confirmação de autorização, mas a fonte ainda deve ser conferida por uma pessoa moderadora: uma declaração do usuário não comprova sua legitimidade por si só.
