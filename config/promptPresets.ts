/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { type ToolId } from '../types';

export interface PromptPreset {
    name: string;
    description: string;
    prompt: string;
}

// Central de presets de prompts profissionais, categorizados por ferramenta (ToolId)
export const promptPresets: Partial<Record<ToolId, PromptPreset[]>> = {
    // Presets para a ferramenta "Gerador de Imagens"
    imageGen: [
        {
            name: 'Estilo Cinematográfico',
            description: 'Cores quentes, iluminação dramática e desfoque de fundo suave.',
            prompt: 'Imagem com estética de filme, cores quentes e ricas, iluminação dramática com sombras profundas e realces sutis, desfoque de fundo (bokeh) suave e cremoso, proporção de tela de cinema widescreen, 8k.'
        },
        {
            name: 'Metrópole Sci-Fi',
            description: 'Arranha-céus imponentes, carros voadores e outdoors holográficos.',
            prompt: 'Uma metrópole de ficção científica expansiva com arranha-céus imponentes, carros voadores e outdoors de neon holográficos, à noite, chuva leve, estilo Blade Runner, fotorrealista, 8k.'
        },
        {
            name: 'Fotografia Macro',
            description: 'Detalhes extremos de um objeto pequeno, como uma gota de chuva.',
            prompt: 'Fotografia macro fotorrealista de uma gota de chuva em uma folha, refletindo o ambiente ao redor, detalhes extremos, 8k.'
        },
        {
            name: 'Cenário de Anime',
            description: 'Cena de uma cidade japonesa à noite, no estilo Studio Ghibli.',
            prompt: 'Cenário de anime de uma rua tranquila de Tóquio à noite, com cerejeiras em flor e lanternas de papel brilhantes, estilo Studio Ghibli.'
        },
    ],
    aiTextEdit: [
        { name: 'Filtro Retrô', description: 'Aplica um visual vintage à imagem.', prompt: 'adicione um filtro retrô com cores desbotadas e um leve grão de filme' },
        { name: 'Pôr do Sol Dramático', description: 'Transforma um céu diurno em um pôr do sol.', prompt: 'faça o céu parecer um pôr do sol dramático com nuvens roxas e alaranjadas' },
        { name: 'Cena de Inverno', description: 'Adiciona neve à paisagem.', prompt: 'adicione neve cobrindo o chão e os galhos das árvores' },
        { name: 'Preto e Branco', description: 'Converte a imagem para P&B de alto contraste.', prompt: 'transforme a foto em preto e branco com alto contraste' },
    ],
    sketchRender: [
        { name: 'Tênis Esportivo', description: 'Cria um render fotorrealista de um tênis.', prompt: 'Renderização fotorrealista de um tênis esportivo, com materiais de couro e malha, em um pedestal de concreto, iluminação de estúdio.' },
        { name: 'Carro Metálico', description: 'Renderiza um carro com pintura vermelha metálica.', prompt: 'Transforme este esboço de carro em um render 3D com pintura metálica vermelha e reflexos de um ambiente urbano.' },
        { name: 'Edifício Moderno', description: 'Cria um edifício de vidro e aço ao pôr do sol.', prompt: 'Renderize este esboço de arquitetura como um edifício moderno de vidro e aço ao pôr do sol.' },
    ],
    characterDesign: [
        { name: 'Cavaleiro Élfico', description: 'Armadura detalhada, pose heroica e fundo de castelo.', prompt: 'Um cavaleiro élfico nobre com armadura de prata ornamentada e uma longa capa verde-musgo. Fundo de um castelo em ruínas ao pôr do sol. Arte conceitual de fantasia, realista.' },
        { name: 'Feiticeira Cibernética', description: 'Cabelo neon, implantes tecnológicos e cidade chuvosa.', prompt: 'Uma feiticeira cibernética com cabelo roxo neon e implantes tecnológicos brilhantes, conjurando um feitiço holográfico em uma cidade futurista e chuvosa. Estilo cyberpunk, fotorrealista.' },
    ],
    videoGen: [
        { name: 'Voo de Drone', description: 'Tomada aérea sobre uma cachoeira.', prompt: 'Uma tomada de drone voando sobre uma cachoeira majestosa em uma floresta tropical, cinematográfica.' },
        { name: 'Câmera Lenta', description: 'Close-up de gotas de chuva em uma poça.', prompt: 'Um close-up de gotas de chuva caindo em uma poça em câmera lenta.' },
    ],
    patternGen: [
        { name: 'Aquarela Cítrica', description: 'Limões e folhas em estilo aquarela.', prompt: 'Padrão sem costura de limões e folhas de laranjeira, estilo aquarela.' },
        { name: 'Art Déco', description: 'Linhas douradas e fundo azul marinho.', prompt: 'Padrão geométrico Art Déco com linhas douradas e fundo azul marinho.' },
    ],
    textEffects: [
        { name: 'Ouro Derretido', description: 'Faz o texto parecer de ouro líquido.', prompt: 'Faça o texto parecer que é feito de ouro derretido com gotas.' },
        { name: 'Textura de Grama', description: 'Aplica uma textura de grama realista.', prompt: 'Aplique uma textura de grama realista ao texto.' },
    ],
    logoGen: [
        { name: 'Marca de Aventura', description: 'Montanha e sol em estilo minimalista.', prompt: 'Logotipo minimalista de uma montanha e um sol para uma marca de aventura.' },
        { name: 'Time de Futebol', description: 'Emblema moderno de um leão.', prompt: 'Emblema de um leão para um time de futebol, estilo moderno.' },
    ],
    stickerCreator: [
        { name: 'Gato Astronauta', description: 'Um gato fofo flutuando no espaço.', prompt: 'Um gato astronauta fofo em estilo anime' },
        { name: 'Café Sorridente', description: 'Um emoji de café feliz em estilo cartoon.', prompt: 'Um emoji de café sorridente em estilo cartoon' },
    ],
    model3DGen: [
        { name: 'Drone Futurista', description: 'Drone com acabamento em fibra de carbono.', prompt: 'Modelo 3D de um drone futurista com acabamento em fibra de carbono.' },
        { name: 'Anel de Diamante', description: 'Anel com um cenário de joalheria.', prompt: 'Modelo 3D de um anel de diamante com um cenário de joalheria.' },
    ],
    relight: [
        { name: 'Hora Dourada', description: 'Luz quente e suave do final da tarde.', prompt: 'Reacenda a foto com uma luz quente e dourada de pôr do sol vindo da direita, com sombras longas e suaves.' },
        { name: 'Neon Noir', description: 'Luzes de neon vibrantes e sombras profundas.', prompt: 'Ilumine a cena com luzes de neon azuis e roxas como se estivesse em uma rua de cyberpunk, com alto contraste e reflexos em superfícies molhadas.' },
    ],
    generativeEdit: [
        { name: 'Adicionar Chapéu', description: 'Coloca um chapéu de pirata na pessoa.', prompt: 'adicione um chapéu de pirata na cabeça da pessoa' },
        { name: 'Mudar Cor do Carro', description: 'Altera a cor do carro para vermelho metálico.', prompt: 'mude a cor do carro para vermelho metálico' },
    ],
    magicMontage: [
        { name: 'Cenário Lunar', description: 'Coloca a pessoa em uma paisagem lunar.', prompt: 'coloque a pessoa em uma paisagem lunar com a Terra ao fundo' },
        { name: 'Adicionar Asas', description: 'Adiciona asas de anjo nas costas da pessoa.', prompt: 'adicione asas de anjo brancas e brilhantes nas costas da pessoa' },
    ],
    outpainting: [
        { name: 'Continuar Praia', description: 'Expande uma cena de praia com mais areia e mar.', prompt: 'continue a praia com mais areia e ondas suaves' },
        { name: 'Céu Estrelado', description: 'Preenche o espaço extra com um céu noturno.', prompt: 'expanda o céu com um céu noturno claro e cheio de estrelas e uma lua cheia brilhante' },
    ],
    productPhotography: [
        { name: 'Mesa de Mármore', description: 'Cenário elegante para produtos de luxo.', prompt: 'em uma mesa de mármore com uma orquídea ao lado' },
        { name: 'Rocha Vulcânica', description: 'Fundo dramático e texturizado.', prompt: 'em um fundo de rocha vulcânica com iluminação dramática' },
    ],
    architecturalViz: [
        { name: 'Piscina Infinita', description: 'Adiciona uma piscina ao jardim.', prompt: 'adicione uma piscina infinita no jardim' },
        { name: 'Paredes de Concreto', description: 'Altera o material das paredes para concreto.', prompt: 'mude as paredes para concreto aparente' },
    ],
    interiorDesign: [
        { name: 'Estante de Livros', description: 'Adiciona uma estante grande à sala.', prompt: 'adicione uma estante de livros de madeira escura do chão ao teto' },
        { name: 'Trocar Sofá', description: 'Substitui o sofá por um novo.', prompt: 'troque o sofá por um de couro marrom e adicione uma planta grande no canto' },
    ],
    bananimate: [
        { name: 'Nuvens em Movimento', description: 'Anima as nuvens para se moverem lentamente.', prompt: 'faça as nuvens se moverem lentamente pelo céu' },
        { name: 'Vapor de Café', description: 'Adiciona vapor animado a uma xícara.', prompt: 'adicione vapor subindo da xícara de café' },
    ],
    aiPortraitStudio: [
        { name: 'Pose de Super-Herói', description: 'Aterrissagem em um telhado, com a cidade ao fundo.', prompt: 'em uma pose de aterrissagem de super-herói em um telhado, com a cidade ao fundo' },
        { name: 'Retrato Real', description: 'Sentado em um trono, vestindo trajes reais.', prompt: 'sentado em um trono ornamentado, vestindo trajes reais e segurando um cetro' },
    ],
    styledPortrait: [
        { name: 'Trocar Cor da Roupa', description: 'Muda a cor de uma peça de roupa específica.', prompt: 'mude a cor da jaqueta para vermelho vibrante' },
        { name: 'Adicionar Acessório', description: 'Adiciona um pequeno detalhe, como uma joia.', prompt: 'adicione um colar de prata delicado' },
    ],
    faceSwap: [
        { name: 'Ajuste de Iluminação', description: 'Instrui a IA a combinar a iluminação do novo rosto com a cena.', prompt: 'Combine perfeitamente a iluminação do novo rosto com a iluminação ambiente da foto original.' },
        { name: 'Leve Sorriso', description: 'Adiciona uma expressão sutil de sorriso ao rosto trocado.', prompt: 'adicione um leve sorriso natural' },
    ],
    newAspectRatio: [
        { name: 'Continuar Praia', description: 'Expande uma cena de praia com mais areia e mar.', prompt: 'continue a cena da praia com mais areia branca e ondas suaves do oceano' },
        { name: 'Céu Estrelado', description: 'Preenche o espaço extra com um céu noturno.', prompt: 'expanda o céu com um céu noturno claro e cheio de estrelas e uma lua cheia brilhante' },
    ],
    vectorConverter: [
        { name: 'Estilo Cartoon', description: 'Converte com cores vibrantes e linhas ousadas.', prompt: 'cores vibrantes e saturadas, contornos pretos ousados, sem gradientes' },
        { name: 'Minimalista', description: 'Usa poucas cores e linhas simples.', prompt: 'estilo de arte de linha minimalista, usando apenas 2-3 cores planas' },
    ],
    imageAnalysis: [
        { name: 'Descrever a Imagem', description: 'Pede à IA uma descrição geral da foto.', prompt: 'Descreva esta imagem em detalhes.' },
        { name: 'Identificar Objeto Principal', description: 'Pergunta qual é o foco principal da imagem.', prompt: 'Qual é o objeto ou assunto principal nesta imagem?' },
        { name: 'Analisar Iluminação', description: 'Pede uma análise do esquema de iluminação.', prompt: 'Descreva a iluminação nesta cena. De onde vem a luz principal?' },
        { name: 'Sugerir Melhorias', description: 'Pede sugestões sobre como melhorar a foto.', prompt: 'Que edições você sugeriria para melhorar esta fotografia?' },
    ],
};


export const negativePromptExamples: Partial<Record<ToolId, string[]>> = {
  imageGen: [
    'texto, marca d\'água, baixa qualidade, feio, deformado',
    'mãos extras, membros faltando, desfocado',
    'cores opacas, chato, sem detalhes',
    'mal desenhado, arte ruim, amador',
  ],
  characterDesign: [
    'proporções erradas, mãos deformadas, rosto genérico',
    'fundo branco simples, pose estática',
    'roupas sem textura, sem detalhes',
  ],
  magicMontage: [
    'não altere o rosto, preserve a identidade da pessoa',
    'iluminação inconsistente, bordas de recorte visíveis',
    'resultado irrealista, estilo de colagem',
    'rosto deformado, mãos extras',
  ],
  generativeEdit: [
    'não altere o fundo, preserve o resto da imagem',
    'resultado desfocado, baixa resolução',
    'iluminação ou sombras que não correspondem',
    'feio, deformado',
  ],
  productPhotography: [
    'fundo confuso, reflexos indesejados',
    'sombras irrealistas, produto flutuando',
    'baixa resolução, textura de plástico barato',
  ],
  relight: [
    'estourado, superexposto, perda de detalhes nas altas luzes',
    'escuro demais, subexposto, perda de detalhes nas sombras',
    'cor da luz irrealista, artificial',
  ],
  outpainting: [
    'bordas visíveis, junção óbvia',
    'conteúdo repetitivo, sem criatividade',
    'inconsistente com o estilo ou iluminação original',
  ],
  styledPortrait: [
    'rosto alterado, perda de identidade, características irreconhecíveis',
    'cabelo de cor errada',
    'artefatos, fusão ruim entre o rosto e o corpo',
    'rosto deformado, feio',
  ],
  tryOn: [
    'rosto alterado, tipo de corpo alterado, tom de pele alterado',
    'roupa mal ajustada, flutuando sobre o corpo',
    'deformado, feio, desfigurado, mãos extras, membros extras',
  ],
};