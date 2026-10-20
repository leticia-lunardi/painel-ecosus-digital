const MESES_ABREV = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];

let DADOS_EVENTOS = {};
let EVENTOS = {};

let estado = {
  slides: [],
  slideIndex: 0,
  timerId: null,
};

async function init() {
  const resp = await fetch("dados_eventos.json");
  DADOS_EVENTOS = await resp.json();
  montarEventos();
  montarhome();

  document.getElementById("btn-auto").addEventListener("click", iniciarAutomatico);
  document.getElementById("btn-manual").addEventListener("click", iniciarManual);
  document.getElementById("btn-voltar-auto").addEventListener("click", voltarInicio);
  document.getElementById("btn-inicio-selecao").addEventListener("click", voltarInicio);
  document.getElementById("btn-anterior").addEventListener("click", () => navegarManual(-1));
  document.getElementById("btn-proximo").addEventListener("click", () => navegarManual(1));
  document.getElementById("btn-trocar-evento").addEventListener("click", iniciarManual);
}

function dividirEmPaginas(lista, tamanho) {
  const paginas = [];
  for (let i = 0; i < lista.length; i += tamanho) {
    paginas.push(lista.slice(i, i + tamanho));
  }
  return paginas;
}

// Monta os eventos a partir do arquivo dados_eventos.json,
// cada um com [slide de alterações, ...slides de doenças por alteração]
function montarEventos() {
  EVENTOS = {};
  for (const [chave, dados] of Object.entries(DADOS_EVENTOS)) {
    const slides = [
      { render: () => renderAlteracoes(dados), duracao: 10 },
    ];
    for (const alteracao of dados.alteracoes) {
      slides.push({ render: () => renderDoencas(dados, alteracao), duracao: 8 });
    }
    const MAX_CUIDADOS_POR_SLIDE = 4;
    const paginasCuidados = dividirEmPaginas(dados.cuidados, MAX_CUIDADOS_POR_SLIDE);
    paginasCuidados.forEach((pagina, i) => {
      const offset = i * MAX_CUIDADOS_POR_SLIDE;
      slides.push({
        render: () =>
          renderCuidados(dados, pagina, offset, i + 1, paginasCuidados.length),
        duracao: 10,
      });
    });
    EVENTOS[chave] = { ...dados, chave, slides };
  }
}

function slidePadrao(dados, titulo, corpoHtml) {
  document.getElementById("alerta-texto").textContent = dados.alerta_atual;
  document.getElementById("caixa-alerta").style.backgroundColor = dados.cor;
  document.getElementById("slide-titulo").textContent = titulo;

  const corpo = document.getElementById("slide-corpo");
  corpo.style.setProperty("--cor-evento", dados.cor);
  corpo.innerHTML = corpoHtml;

  corpo.classList.remove("animar-slide");
  void corpo.offsetWidth;
  corpo.classList.add("animar-slide");

  renderTrilhaMeses(document.getElementById("slide-trilha"), dados.meses_pico, dados.cor);
}

function renderAlteracoes(dados) {
  const itens = dados.alteracoes
    .map((alt) => `<div class="item-grid">${alt.tipo}</div>`)
    .join("");
  slidePadrao(dados, "Atenção especial", `<div class="grid-itens grid-alteracoes">${itens}</div>`);
}

function renderDoencas(dados, alteracao) {
  const itens = alteracao.doencas
    .map((d) => `<div class="item-grid">${d}</div>`)
    .join("");
  slidePadrao(dados, "Possíveis "+alteracao.tipo, `<div class="grid-itens grid-doencas">${itens}</div>`);
}

function renderCuidados(dados, cuidados, offset, pagina, totalPaginas) {
  const itens = cuidados
    .map(
      (cuidado, i) => `
      <div class="cuidado-item">
        <span class="cuidado-numero">${offset + i + 1}</span>
        <span class="cuidado-texto">${cuidado}</span>
      </div>`
    )
    .join("");

  const titulo =
    totalPaginas > 1 ? `Cuidados recomendados (${pagina}/${totalPaginas})` : "Cuidados recomendados";

  slidePadrao(dados, titulo, `<div class="lista-cuidados">${itens}</div>`);
}

// Sazonalidade: utiliza a lógica de distância circular
function distanciaMes(a, b) {
  const diff = Math.abs(a - b);
  return Math.min(diff, 12 - diff);
}

function relevancia(evento, mesAtual) {
  return Math.min(...evento.meses_pico.map((m) => distanciaMes(mesAtual, m)));
}

function eventosOrdenados(mesAtual = new Date().getMonth() + 1) {
  return Object.keys(EVENTOS).sort(
    (a, b) => relevancia(EVENTOS[a], mesAtual) - relevancia(EVENTOS[b], mesAtual)
  );
}

function slidesAutomaticos() {
  const slides = [];
  for (const chave of eventosOrdenados()) {
    slides.push(...EVENTOS[chave].slides);
  }
  return slides;
}

// Trilha de meses
function renderTrilhaMeses(container, mesesPico, cor) {
  const mesAtual = new Date().getMonth() + 1;
  container.innerHTML = MESES_ABREV.map((label, i) => {
    const mes = i + 1;
    const ehPico = mesesPico.includes(mes);
    const ehAtual = mes === mesAtual;
    const classes = ["mes-dot"];
    if (ehPico) classes.push("pico");
    if (ehAtual) classes.push("atual");
    const corBolha = ehPico ? cor : "";
    return `
      <div class="${classes.join(" ")}">
        <div class="bolha" style="${corBolha ? `background:${corBolha}` : ""}"></div>
        <span>${label}</span>
      </div>`;
  }).join("");
}

function montarhome() {
  const tituloEl = document.getElementById("home-titulo");
  const subEl = document.getElementById("home-sub");
  const trilhaEl = document.getElementById("home-trilha");

  if (!tituloEl && !subEl && !trilhaEl) return;

  const ordenados = eventosOrdenados();
  const topo = EVENTOS[ordenados[0]];

  if (trilhaEl) {
    renderTrilhaMeses(trilhaEl, topo.meses_pico, topo.cor);
  }
}

// Navegação entre telas
function mostrarTela(id) {
  document.querySelectorAll(".tela").forEach((t) => t.classList.add("oculta"));
  document.getElementById(id).classList.remove("oculta");
}

function pararTimer() {
  if (estado.timerId) {
    clearTimeout(estado.timerId);
    estado.timerId = null;
  }
}

function voltarInicio() {
  pararTimer();
  estado = { slides: [], slideIndex: 0, timerId: null };
  montarhome();
  mostrarTela("tela-inicial");
}

// Modo automático
function iniciarAutomatico() {
  estado.slides = slidesAutomaticos();
  estado.slideIndex = 0;

  mostrarTela("tela-slide");
  document.getElementById("controles-auto").classList.remove("oculta");
  document.getElementById("controles-manual").classList.add("oculta");

  exibirSlideAutomatico();
}

function exibirSlideAutomatico() {
  const slide = estado.slides[estado.slideIndex];
  slide.render();

  const barra = document.getElementById("barra-progresso");
  barra.style.transition = "none";
  barra.style.width = "0%";
  void barra.offsetWidth; // força reflow para reiniciar a animação
  barra.style.transition = `width ${slide.duracao}s linear`;
  barra.style.width = "100%";

  pararTimer();
  estado.timerId = setTimeout(() => {
    estado.slideIndex = (estado.slideIndex + 1) % estado.slides.length;
    exibirSlideAutomatico();
  }, slide.duracao * 1000);
}

// Modo manual
function iniciarManual() {
  pararTimer();
  mostrarTela("tela-selecao-evento");
  renderBotoesEventos();
}

function renderBotoesEventos() {
  const container = document.getElementById("botoes-eventos");
  container.innerHTML = "";
  for (const chave of eventosOrdenados()) {
    const dados = EVENTOS[chave];
    const btn = document.createElement("button");
    btn.className = "botao-evento";
    btn.textContent = dados.nome;
    btn.style.backgroundColor = dados.cor;
    btn.addEventListener("click", () => selecionarEvento(chave));
    container.appendChild(btn);
  }
}

function selecionarEvento(chave) {
  estado.slides = EVENTOS[chave].slides;
  estado.slideIndex = 0;

  mostrarTela("tela-slide");
  document.getElementById("controles-auto").classList.add("oculta");
  document.getElementById("controles-manual").classList.remove("oculta");

  estado.slides[estado.slideIndex].render();
}

function navegarManual(direcao) {
  const total = estado.slides.length;
  estado.slideIndex = (estado.slideIndex + direcao + total) % total;
  estado.slides[estado.slideIndex].render();
}

document.addEventListener("DOMContentLoaded", init);