/* =========================================================
   ELEMENTOS
========================================================= */

const noButton =
    document.getElementById("noButton");

const yesButton =
    document.getElementById("yesButton");

const finalYesButton =
    document.getElementById("finalYesButton");

const questionCard =
    document.getElementById("questionCard");

const finalCard =
    document.getElementById("finalCard");

const gameOverScreen =
    document.getElementById("gameOverScreen");

const startOverlay =
    document.getElementById("startOverlay");

const startButton =
    document.getElementById("startButton");

const finalWarning =
    document.getElementById("finalWarning");

const transitionScreen =
    document.getElementById("transitionScreen");

const goEyesContainer =
    document.getElementById("goEyes");

const counter =
    document.getElementById("counter");

const reaction =
    document.getElementById("reaction");

const title =
    document.getElementById("title");

const description =
    document.getElementById("description");

const dangerFill =
    document.getElementById("dangerFill");

const dangerPercent =
    document.getElementById("dangerPercent");

const playZone =
    document.getElementById("playZone");

const embers =
    document.getElementById("embers");

const finalStat =
    document.getElementById("finalStat");

const youtubePlayer =
    document.getElementById("youtubePlayer");



/* =========================================================
   CONFIGURAÇÕES
========================================================= */

const CONFIG = {

    fireStart: 5,

    darknessStart: 13,

    eyesStart: 17,

    gameOverStart: 25,

    youtubeVideo:
        "nyuo9-OjNNg"

};



/* =========================================================
   ESTADO
========================================================= */

let attempts = 0;

let finished = false;

let lastPosition = null;

/*
 * Impede novas tentativas durante a transição
 * do aviso final -> tela de game over.
 */

let transitioning = false;

/*
 * Marca se o jogo chegou a ativar a tela de
 * GAME OVER — usada pra decidir se mostramos a
 * tela de transição antes da tela final.
 */

let reachedGameOver = false;

let transitionShown = false;

let transitionTimeoutId = null;

/*
 * Garante que o aviso final só apareça uma vez.
 */

let warningShown = false;



/* =========================================================
   ÁUDIO — TOQUES E EFEITOS SONOROS

   Tudo é gerado por código (Web Audio API), sem depender
   de nenhum arquivo de áudio externo. Isso evita perder
   som por causa de link quebrado e mantém o projeto leve.
========================================================= */

let audioCtx = null;

let droneNodes = null;


function getAudioContext() {

    /*
     * Navegadores só permitem tocar áudio depois de
     * alguma interação do usuário. Por isso criamos o
     * contexto sob demanda e reaproveitamos sempre.
     */

    if (!audioCtx) {

        const AudioContextClass =
            window.AudioContext ||
            window.webkitAudioContext;

        if (!AudioContextClass) {

            return null;

        }

        audioCtx =
            new AudioContextClass();

    }


    if (audioCtx.state === "suspended") {

        audioCtx.resume();

    }


    return audioCtx;

}


/*
 * Gera um buffer de ruído branco, usado como base
 * para os efeitos de "whoosh", estática e sopro.
 */

function createNoiseBuffer(duration) {

    const ctx =
        getAudioContext();


    if (!ctx) {

        return null;

    }


    const bufferSize =
        Math.floor(
            ctx.sampleRate * duration
        );

    const buffer =
        ctx.createBuffer(
            1,
            bufferSize,
            ctx.sampleRate
        );

    const data =
        buffer.getChannelData(0);


    for (
        let i = 0;
        i < bufferSize;
        i++
    ) {

        data[i] =
            Math.random() * 2 - 1;

    }


    return buffer;

}


/*
 * Toca uma rajada de ruído filtrado — usada pra
 * simular sopro de fogo, estática ou "sussurro".
 */

function playNoiseBurst({

    duration = 0.15,
    volume = 0.05,
    filterFrequency = 900,
    filterType = "bandpass",
    delay = 0

} = {}) {

    const ctx =
        getAudioContext();

    const buffer =
        createNoiseBuffer(duration);


    if (!ctx || !buffer) {

        return;

    }


    const source =
        ctx.createBufferSource();

    source.buffer =
        buffer;


    const filter =
        ctx.createBiquadFilter();

    filter.type =
        filterType;

    filter.frequency.value =
        filterFrequency;


    const gain =
        ctx.createGain();

    const startTime =
        ctx.currentTime + delay;


    gain.gain.setValueAtTime(
        0,
        startTime
    );

    gain.gain.linearRampToValueAtTime(
        volume,
        startTime + 0.015
    );

    gain.gain.exponentialRampToValueAtTime(
        0.0001,
        startTime + duration
    );


    source.connect(filter);

    filter.connect(gain);

    gain.connect(ctx.destination);


    source.start(startTime);

    source.stop(startTime + duration + 0.05);

}


/*
 * Toca uma nota simples com um envelope suave
 * (fade in/out) pra não estourar o som.
 */

function playTone({

    frequency = 440,
    duration = 0.18,
    type = "sine",
    volume = 0.08,
    delay = 0,
    detune = 0

} = {}) {

    const ctx =
        getAudioContext();


    if (!ctx) {

        return;

    }


    const oscillator =
        ctx.createOscillator();

    const gain =
        ctx.createGain();


    oscillator.type =
        type;

    oscillator.frequency.value =
        frequency;

    oscillator.detune.value =
        detune;


    const startTime =
        ctx.currentTime + delay;


    gain.gain.setValueAtTime(
        0,
        startTime
    );

    gain.gain.linearRampToValueAtTime(
        volume,
        startTime + 0.015
    );

    gain.gain.exponentialRampToValueAtTime(
        0.0001,
        startTime + duration
    );


    oscillator.connect(gain);

    gain.connect(ctx.destination);


    oscillator.start(startTime);

    oscillator.stop(startTime + duration + 0.05);

}


/*
 * Pequeno "toque" de boas vindas, tocado quando
 * a pergunta principal aparece na tela.
 */

function playIntroChime() {

    playTone({

        frequency: 660,
        duration: 0.16,
        type: "sine",
        volume: 0.07,
        delay: 0

    });

    playTone({

        frequency: 880,
        duration: 0.22,
        type: "sine",
        volume: 0.06,
        delay: 0.12

    });

}


/*
 * Som do botão NÃO. Muda de "cara" em cada fase do
 * jogo, acompanhando o clima que vai ficando mais
 * tenso — de um clique inofensivo até algo bem
 * sombrio perto do final.
 */

function playNoSound(currentAttempts) {


    /*
     * FASE 1 — só um clique normal de botão,
     * nada de especial ainda.
     */

    if (currentAttempts < CONFIG.fireStart) {

        playTone({

            frequency: 240,
            duration: 0.1,
            type: "square",
            volume: 0.05

        });

        return;

    }


    /*
     * FASE 2 — a página está pegando fogo,
     * então entra um "whoosh" de sopro.
     */

    if (currentAttempts < CONFIG.darknessStart) {

        playTone({

            frequency: 200,
            duration: 0.12,
            type: "square",
            volume: 0.05

        });

        playNoiseBurst({

            duration: 0.22,
            volume: 0.05,
            filterFrequency: 1500,
            filterType: "bandpass"

        });

        return;

    }


    /*
     * FASE 3 — escureceu. Um batimento cardíaco
     * grave, tipo tensão de filme de terror.
     */

    if (currentAttempts < CONFIG.eyesStart) {

        playTone({

            frequency: 72,
            duration: 0.16,
            type: "sine",
            volume: 0.1

        });

        playTone({

            frequency: 62,
            duration: 0.2,
            type: "sine",
            volume: 0.08,
            delay: 0.16

        });

        return;

    }


    /*
     * FASE 4 — os olhos apareceram. Um acorde
     * dissonante (duas notas quase coladas),
     * junto de um sopro mais agudo e áspero.
     */

    if (currentAttempts < CONFIG.gameOverStart - 3) {

        playTone({

            frequency: 180,
            duration: 0.32,
            type: "sawtooth",
            volume: 0.05

        });

        playTone({

            frequency: 191,
            duration: 0.32,
            type: "sawtooth",
            volume: 0.045,
            detune: -18

        });

        playNoiseBurst({

            duration: 0.28,
            volume: 0.03,
            filterFrequency: 2600,
            filterType: "highpass"

        });

        return;

    }


    /*
     * FASE 5 — reta final antes do aviso.
     * A dissonância cresce e o som fica mais
     * grave e mais "quebrado" a cada clique.
     */

    const proximity =

        (
            currentAttempts -
            (CONFIG.gameOverStart - 3)
        ) / 3;


    playTone({

        frequency: 150 - proximity * 45,
        duration: 0.4,
        type: "sawtooth",
        volume: 0.06 + proximity * 0.03

    });

    playTone({

        frequency: 158 - proximity * 45,
        duration: 0.4,
        type: "sawtooth",
        volume: 0.05 + proximity * 0.03,
        detune: -22

    });

    playNoiseBurst({

        duration: 0.32,
        volume: 0.035 + proximity * 0.02,
        filterFrequency: 3200,
        filterType: "highpass"

    });

}


/*
 * Drone grave que vai ganhando corpo desde o
 * primeiro "não", ficando mais grave e mais alto de
 * forma cadenciada conforme as tentativas avançam.
 * É o "toque sombrio" que cresce aos poucos, antes
 * do drone ainda mais intenso da tela de game over.
 */

let tensionDroneNodes = null;


function updateTensionDrone(currentAttempts) {


    if (currentAttempts < 1) {

        return;

    }


    const ctx =
        getAudioContext();


    if (!ctx) {

        return;

    }


    /*
     * Progresso contínuo do primeiro "não" (0) até
     * a última tentativa antes do game over (1).
     */

    const progress =
        Math.min(

            currentAttempts /
            CONFIG.gameOverStart,

            1

        );


    if (!tensionDroneNodes) {

        const oscillator =
            ctx.createOscillator();

        oscillator.type =
            "sawtooth";

        oscillator.frequency.value =
            135;


        const gain =
            ctx.createGain();

        gain.gain.value =
            0;


        oscillator.connect(gain);

        gain.connect(ctx.destination);


        oscillator.start();


        tensionDroneNodes = {

            oscillator,
            gain

        };

    }


    const {
        oscillator,
        gain
    } = tensionDroneNodes;


    const targetFrequency =
        135 - progress * 75;

    const targetVolume =
        0.006 + progress * 0.058;


    oscillator.frequency.linearRampToValueAtTime(

        targetFrequency,

        ctx.currentTime + 0.5

    );

    gain.gain.linearRampToValueAtTime(

        targetVolume,

        ctx.currentTime + 0.5

    );

}


function stopTensionDrone() {

    if (!tensionDroneNodes || !audioCtx) {

        return;

    }


    const {
        oscillator,
        gain
    } = tensionDroneNodes;


    gain.gain.linearRampToValueAtTime(

        0,

        audioCtx.currentTime + 0.5

    );


    oscillator.stop(
        audioCtx.currentTime + 0.55
    );


    tensionDroneNodes = null;

}


/*
 * Usa a síntese de voz do navegador pra "falar"
 * a frase de aviso final. Se o navegador não
 * suportar, simplesmente não fala nada — o resto
 * do efeito (tela + som) continua funcionando.
 */

function speakWarning(text) {

    if (!("speechSynthesis" in window)) {

        return;

    }


    try {

        const utterance =
            new SpeechSynthesisUtterance(text);


        utterance.lang =
            "pt-BR";

        utterance.rate =
            0.85;

        utterance.pitch =
            0.6;

        utterance.volume =
            0.9;


        const voices =
            window.speechSynthesis.getVoices();

        const portugueseVoice =
            voices.find(

                (voice) =>

                    voice.lang &&
                    voice.lang
                        .toLowerCase()
                        .startsWith("pt")

            );


        if (portugueseVoice) {

            utterance.voice =
                portugueseVoice;

        }


        window.speechSynthesis.cancel();

        window.speechSynthesis.speak(utterance);

    }

    catch (error) {

        /*
         * Se algo falhar na síntese de voz,
         * seguimos em silêncio — não é crítico.
         */

    }

}


/*
 * Som positivo do botão SIM / ACEITAR.
 */

function playYesSound() {

    playTone({

        frequency: 523.25,
        duration: 0.16,
        type: "sine",
        volume: 0.09,
        delay: 0

    });

    playTone({

        frequency: 659.25,
        duration: 0.18,
        type: "sine",
        volume: 0.09,
        delay: 0.09

    });

    playTone({

        frequency: 783.99,
        duration: 0.32,
        type: "sine",
        volume: 0.09,
        delay: 0.18

    });

}


/*
 * Som de "espera, o quê?!" tocado assim que a pessoa
 * clica em ACEITAR vindo da tela de game over — um
 * susto/confusão que depois se resolve num acorde
 * quentinho, acompanhando a virada de clima.
 */

function playSurpriseSound() {

    playTone({

        frequency: 320,
        duration: 0.1,
        type: "triangle",
        volume: 0.06,
        delay: 0

    });

    playTone({

        frequency: 210,
        duration: 0.16,
        type: "triangle",
        volume: 0.05,
        delay: 0.11

    });

    playTone({

        frequency: 392,
        duration: 0.4,
        type: "sine",
        volume: 0.06,
        delay: 0.55

    });

    playTone({

        frequency: 493.88,
        duration: 0.45,
        type: "sine",
        volume: 0.06,
        delay: 0.68

    });

}


/*
 * Drone grave e sombrio que toca em loop enquanto a
 * tela de GAME OVER estiver ativa.
 */

function startGameOverDrone() {

    const ctx =
        getAudioContext();


    if (!ctx || droneNodes) {

        return;

    }


    const oscillatorLow =
        ctx.createOscillator();

    const oscillatorDetuned =
        ctx.createOscillator();

    const gain =
        ctx.createGain();


    oscillatorLow.type =
        "sawtooth";

    oscillatorLow.frequency.value =
        55;


    oscillatorDetuned.type =
        "sawtooth";

    oscillatorDetuned.frequency.value =
        55;

    oscillatorDetuned.detune.value =
        9;


    gain.gain.setValueAtTime(

        0,
        ctx.currentTime

    );

    gain.gain.linearRampToValueAtTime(

        0.035,
        ctx.currentTime + 1.2

    );


    oscillatorLow.connect(gain);

    oscillatorDetuned.connect(gain);

    gain.connect(ctx.destination);


    oscillatorLow.start();

    oscillatorDetuned.start();


    droneNodes = {

        oscillatorLow,
        oscillatorDetuned,
        gain

    };

}


function stopGameOverDrone() {

    if (!droneNodes || !audioCtx) {

        return;

    }


    const { oscillatorLow, oscillatorDetuned, gain } =
        droneNodes;


    gain.gain.linearRampToValueAtTime(

        0,
        audioCtx.currentTime + 0.6

    );


    oscillatorLow.stop(
        audioCtx.currentTime + 0.65
    );

    oscillatorDetuned.stop(
        audioCtx.currentTime + 0.65
    );


    droneNodes = null;

}


/*
 * Destrava o áudio assim que houver a primeira
 * interação do usuário (necessário em vários
 * navegadores) e aproveita pra tocar o toquezinho
 * inicial caso ainda não tenha tocado.
 */

let introChimePlayed = false;


function unlockAudioAndGreet() {

    getAudioContext();


    if (!introChimePlayed) {

        introChimePlayed = true;

        playIntroChime();

    }

}


document.addEventListener(

    "pointerdown",

    unlockAudioAndGreet,

    { once: true }

);


document.addEventListener(

    "keydown",

    unlockAudioAndGreet,

    { once: true }

);


/*
 * Este é o clique que realmente importa: um gesto
 * genuíno do usuário, logo no início, antes de
 * qualquer interação por hover. É isso que garante
 * que os sons do "não" e o som da tela de game over
 * (que começam sozinhos, sem clique) consigam tocar
 * mais tarde.
 */

if (startButton) {

    startButton.addEventListener(

        "click",

        function() {

            unlockAudioAndGreet();


            startOverlay.classList.add(
                "hidden"
            );


            startOverlay.setAttribute(
                "aria-hidden",
                "true"
            );

        }

    );

}


window.addEventListener(

    "load",

    function() {

        /*
         * Em navegadores que permitem áudio sem
         * interação, o toque já entra direto.
         */

        const ctx =
            getAudioContext();


        if (ctx && ctx.state === "running") {

            unlockAudioAndGreet();

        }

    }

);



/* =========================================================
   FRASES DO NÃO
========================================================= */

const noPhrases = [

    "NÃO",

    "TEM CERTEZA? 👀",

    "PENSA MELHOR...",

    "VOCÊ CLICOU ERRADO? 😂",

    "SÉRIO ISSO? 😭",

    "DEPOIS DE TUDO? 🥺",

    "OLHA O SIM ALI ❤️",

    "VOCÊ ESTÁ INSISTINDO?",

    "ESSA ESCOLHA É QUESTIONÁVEL 😂",

    "AINDA DÁ TEMPO.",

    "VOCÊ É TEIMOSA, HEIN? 😂",

    "MEU CORAÇÃO... 🥲",

    "ISSO ESTÁ FICANDO PESSOAL.",

    "VOCÊ CHEGOU ATÉ AQUI?",

    "EU ESTOU PERDENDO A PACIÊNCIA 😭",

    "ACEITA LOGO ❤️",

    "POR FAVOR 🥺",

    "A PÁGINA ESTÁ PEGANDO FOGO 🔥",

    "SOCORRO 🔥😭",

    "VOCÊ AINDA ESTÁ AQUI?!",

    "CHEGA 😂",

    "OK...",

    "VOCÊ VAI ATÉ O FIM?",

    "ÚLTIMA CHANCE ❤️"

];



/* =========================================================
   REAÇÕES
========================================================= */

const reactions = [

    "Tentativa registrada. 🤨",

    "O botão decidiu fugir. 😂",

    "Isso foi desnecessário. 😭",

    "Estou começando a ficar preocupado.",

    "Por que você está fazendo isso comigo? 🥺",

    "Eu sabia que você faria isso de novo. 👀",

    "Você gosta mesmo de me provocar.",

    "O SIM continua esperando. ❤️",

    "O sistema está analisando sua decisão...",

    "Temperatura aumentando. 🌡️",

    "Detectado: teimosia extrema.",

    "🔥 ALERTA: temperatura crítica 🔥",

    "Talvez seja melhor escolher SIM.",

    "Você literalmente está incendiando a página. 😂",

    "Eu avisei. 🔥",

    "Ok... isso virou um jogo de terror. 👹"

];



/* =========================================================
   TENTATIVA DE NÃO
========================================================= */

function rejectAttempt() {


    if (finished || transitioning) {

        return;

    }


    attempts++;


    playNoSound(attempts);


    counter.textContent =
        attempts;


    updateNoText();

    updateReaction();

    updateMessages();

    updateDanger();

    updateFire();

    updateDarkness();

    updateTensionVisuals(attempts);

    updateTensionDrone(attempts);

    updateYesButton();

    moveNoButton();


    /*
     * Se chegou à última tentativa, primeiro
     * mostra o aviso final ("Você tem certeza...")
     * e só depois revela a tela de GAME OVER.
     */

    if (
        attempts >=
        CONFIG.gameOverStart &&
        !warningShown
    ) {

        warningShown = true;

        triggerFinalWarning();

    }

}



/* =========================================================
   TEXTO DO NÃO
========================================================= */

function updateNoText() {

    const index =
        Math.min(
            attempts,
            noPhrases.length - 1
        );


    noButton.textContent =
        noPhrases[index];

}



/* =========================================================
   REAÇÃO
========================================================= */

function updateReaction() {

    const index =
        Math.floor(
            Math.random() *
            reactions.length
        );


    reaction.textContent =
        reactions[index];

}



/* =========================================================
   MENSAGENS PRINCIPAIS
========================================================= */

function updateMessages() {


    if (attempts === 3) {

        title.textContent =
            "Ainda pensando? 👀";

        description.textContent =
            "Eu vou considerar isso um talvez.";

    }


    if (attempts === 6) {

        title.textContent =
            "Você está insistindo...";

        description.textContent =
            "O botão SIM continua esperando. ❤️";

    }


    if (attempts === 10) {

        title.textContent =
            "Tá bom... 😂";

        description.textContent =
            "Você realmente quer brincar disso.";

    }


    if (attempts === 13) {

        title.textContent =
            "Está ficando estranho...";

        description.textContent =
            "Por que tudo ficou tão escuro? 👀";

    }


    if (attempts === 17) {

        title.textContent =
            "VOCÊ FOI LONGE DEMAIS.";

        description.textContent =
            "Eu avisei que isso teria consequências.";

    }


    if (attempts === 22) {

        title.textContent =
            "NÃO EXISTE MAIS VOLTA.";

        description.textContent =
            "O sistema está chegando ao limite.";

    }


    if (
        attempts >=
        CONFIG.gameOverStart
    ) {

        title.textContent =
            "GAME OVER";

        description.textContent =
            "Você encontrou o final secreto.";

    }

}



/* =========================================================
   PERIGO
========================================================= */

function updateDanger() {


    /*
     * 25 tentativas = 100%.
     */

    const percentage =
        Math.min(
            (
                attempts /
                CONFIG.gameOverStart
            ) * 100,
            100
        );


    dangerFill.style.width =
        `${percentage}%`;


    dangerPercent.textContent =
        `${Math.round(percentage)}%`;

}



/* =========================================================
   FOGO
========================================================= */

function updateFire() {


    if (
        attempts <
        CONFIG.fireStart
    ) {

        return;

    }


    const intensity =
        Math.min(

            (
                attempts -
                CONFIG.fireStart
            ) / 20,

            1

        );


    document.documentElement
        .style
        .setProperty(
            "--fire",
            intensity
        );


    const fire =
        document.getElementById(
            "fire"
        );


    fire.style.opacity =
        intensity;


    /*
     * Mais tentativas =
     * mais brasas.
     */

    createEmbers(
        Math.max(
            1,
            Math.floor(
                intensity * 5
            )
        )
    );

}



/* =========================================================
   ESCURIDÃO
========================================================= */

function updateDarkness() {


    if (
        attempts <
        CONFIG.darknessStart
    ) {

        return;

    }


    const darkLevel =
        Math.min(

            (
                attempts -
                CONFIG.darknessStart
            ) / 14,

            0.95

        );


    document.documentElement
        .style
        .setProperty(
            "--dark",
            darkLevel
        );


    document.body
        .classList
        .add(
            "dark-mode"
        );

}



/* =========================================================
   TENSÃO VISUAL — AMBIENTE FICA IMERSIVO

   Desde o primeiro "não", a janela (card) começa a
   perder fundo, borda, sombra e blur, e todo o
   conteúdo dentro dela vai escurecendo/avermelhando
   junto — até parecer que não existe mais nenhuma
   "janela", só o ambiente sombrio tomando conta da
   tela inteira.
========================================================= */

function updateTensionVisuals(currentAttempts) {


    const progress =
        Math.min(

            currentAttempts /
            CONFIG.gameOverStart,

            1

        );


    document.documentElement
        .style
        .setProperty(
            "--tension",
            progress.toFixed(3)
        );

}



/* =========================================================
   BRASAS
========================================================= */

function createEmbers(amount) {


    for (
        let i = 0;
        i < amount;
        i++
    ) {


        const ember =
            document.createElement(
                "span"
            );


        ember.className =
            "ember";


        ember.style.left =
            `${Math.random() * 100}%`;


        ember.style.setProperty(

            "--drift",

            `${-120 + Math.random() * 240}px`

        );


        ember.style.animationDuration =
            `${2 + Math.random() * 3}s`;


        embers.appendChild(
            ember
        );


        setTimeout(

            () => {

                ember.remove();

            },

            6000

        );

    }

}



/* =========================================================
   MOVE O BOTÃO
========================================================= */

function moveNoButton() {


    const zoneWidth =
        playZone.clientWidth;


    const zoneHeight =
        playZone.clientHeight;


    const buttonWidth =
        noButton.offsetWidth;


    const buttonHeight =
        noButton.offsetHeight;


    /*
     * O SIM está aproximadamente
     * nessa região.
     */

    const yesCenterX =
        zoneWidth * 0.65;


    const yesCenterY =
        zoneHeight * 0.50;


    /*
     * Distância mínima.
     */

    const minimumDistance =
        window.innerWidth < 600
            ? 105
            : 130;


    let position = null;



    /*
     * Tenta até 150 posições.
     */

    for (
        let i = 0;
        i < 150;
        i++
    ) {


        const x =
            8 +
            Math.random() *
            Math.max(
                1,
                zoneWidth -
                buttonWidth -
                16
            );


        const y =
            10 +
            Math.random() *
            Math.max(
                1,
                zoneHeight -
                buttonHeight -
                20
            );


        const noCenterX =
            x +
            buttonWidth / 2;


        const noCenterY =
            y +
            buttonHeight / 2;


        const distance =
            Math.hypot(

                noCenterX -
                    yesCenterX,

                noCenterY -
                    yesCenterY

            );


        /*
         * Não pode ficar perto do SIM.
         */

        if (
            distance <
            minimumDistance
        ) {

            continue;

        }


        /*
         * Não fica praticamente
         * no mesmo lugar anterior.
         */

        if (lastPosition) {


            const movement =
                Math.hypot(

                    x -
                        lastPosition.x,

                    y -
                        lastPosition.y

                );


            if (
                movement < 50
            ) {

                continue;

            }

        }


        position = {

            x,
            y

        };


        break;

    }



    /*
     * Fallback seguro.
     */

    if (!position) {

        position = {

            x: 10,

            y: 15

        };

    }


    lastPosition =
        position;


    /*
     * Remove a posição inicial
     * baseada em translateY.
     */

    noButton.style.transform =
        "none";


    noButton.style.left =
        `${position.x}px`;


    noButton.style.top =
        `${position.y}px`;


    /*
     * Pequena animação.
     */

    noButton.animate(

        [

            {
                transform:
                    "scale(.8) rotate(-6deg)"
            },

            {
                transform:
                    "scale(1.08) rotate(4deg)"
            },

            {
                transform:
                    "scale(1) rotate(0)"
            }

        ],

        {

            duration: 280,

            easing:
                "ease-out"

        }

    );

}



/* =========================================================
   SIM FICA MAIOR
========================================================= */

function updateYesButton() {


    const scale =
        Math.min(

            1 +
            attempts * 0.012,

            1.22

        );


    yesButton.style.transform =

        `translate(
            -50%,
            -50%
        )
        scale(${scale})`;

}



/* =========================================================
   AVISO FINAL — TRANSIÇÃO PARA O GAME OVER
========================================================= */

function triggerFinalWarning() {


    transitioning = true;


    /*
     * O drone de tensão contínuo dá lugar ao
     * momento de silêncio pesado do aviso.
     */

    stopTensionDrone();


    /*
     * Desativa os botões por baixo enquanto o
     * aviso está na tela, pra não haver cliques
     * "perdidos" durante a transição.
     */

    noButton.style.pointerEvents =
        "none";

    yesButton.style.pointerEvents =
        "none";


    /*
     * Um acorde grave e tenso, seguido da
     * frase falada.
     */

    playTone({

        frequency: 98,
        duration: 0.7,
        type: "sawtooth",
        volume: 0.08

    });

    playTone({

        frequency: 104,
        duration: 0.7,
        type: "sawtooth",
        volume: 0.06,
        detune: -25,
        delay: 0.05

    });


    speakWarning(
        "Você tem certeza que quer isso?"
    );


    finalWarning.classList.add(
        "active"
    );

    finalWarning.setAttribute(
        "aria-hidden",
        "false"
    );


    /*
     * Depois de alguns segundos, some com o
     * aviso e revela a tela de game over completa.
     */

    setTimeout(

        function() {

            finalWarning.classList.remove(
                "active"
            );

            finalWarning.setAttribute(
                "aria-hidden",
                "true"
            );


            noButton.style.pointerEvents =
                "";

            yesButton.style.pointerEvents =
                "";


            transitioning = false;


            showGameOver();

        },

        2600

    );

}



/* =========================================================
   OLHOS EXTRAS NA TELA DE GAME OVER
========================================================= */

function spawnStrayEyes() {


    if (!goEyesContainer) {

        return;

    }


    goEyesContainer.innerHTML =
        "";


    const amount = 6;


    for (
        let i = 0;
        i < amount;
        i++
    ) {


        const eye =
            document.createElement(
                "div"
            );


        eye.className =
            "stray-eye";


        eye.style.left =
            `${5 + Math.random() * 90}%`;


        eye.style.top =
            `${8 + Math.random() * 84}%`;


        eye.style.transform =

            `rotate(${
                -25 + Math.random() * 50
            }deg)`;


        goEyesContainer.appendChild(
            eye
        );


        /*
         * Cada olho "acorda" em um momento
         * diferente — um fade-in escalonado,
         * como se fossem surgindo aos poucos
         * na escuridão, em vez de todos de
         * uma vez.
         */

        const revealDelay =
            350 +
            i * 380 +
            Math.random() * 250;


        setTimeout(

            function() {

                eye.classList.add(
                    "revealed"
                );


                /*
                 * Só depois de revelado é que
                 * o olho passa a piscar.
                 */

                setTimeout(

                    function() {

                        eye.style.animationDelay =
                            `${Math.random() * 3}s`;

                        eye.classList.add(
                            "blinking"
                        );

                    },

                    900

                );

            },

            revealDelay

        );

    }

}



/* =========================================================
   GAME OVER
========================================================= */

function showGameOver() {


    if (
        gameOverScreen.classList
            .contains("active")
    ) {

        return;

    }


    /*
     * Ativa o overlay.
     */

    gameOverScreen
        .classList
        .add(
            "active"
        );


    gameOverScreen
        .setAttribute(
            "aria-hidden",
            "false"
        );


    /*
     * Mantém a tela funcionando
     * por baixo do overlay.
     */

    document.body
        .classList
        .add(
            "dark-mode"
        );


    spawnStrayEyes();

    startGameOverDrone();


    reachedGameOver = true;

}



/* =========================================================
   ACEITAR
========================================================= */

function acceptProposal() {


    if (finished) {

        return;

    }


    /*
     * Se a pessoa chegou até o game over, a virada
     * pra tela final não pode ser abrupta — primeiro
     * mostramos a tela de transição/surpresa, e só
     * depois disso a tela final entra.
     */

    if (
        reachedGameOver &&
        !transitionShown
    ) {

        transitionShown = true;

        beginSurpriseTransition();

        return;

    }


    finalizeAcceptance();

}



/* =========================================================
   TRANSIÇÃO DE SURPRESA
========================================================= */

function beginSurpriseTransition() {


    stopGameOverDrone();

    stopTensionDrone();

    playSurpriseSound();


    transitionScreen
        .classList
        .add(
            "active"
        );

    transitionScreen
        .setAttribute(
            "aria-hidden",
            "false"
        );


    /*
     * Tocar em qualquer lugar da tela de transição
     * pula direto pra tela final.
     */

    transitionScreen.addEventListener(

        "click",

        skipSurpriseTransition,

        { once: true }

    );


    transitionTimeoutId =
        setTimeout(

            function() {

                endSurpriseTransition();

            },

            4200

        );

}


function skipSurpriseTransition() {

    clearTimeout(
        transitionTimeoutId
    );


    endSurpriseTransition();

}


function endSurpriseTransition() {

    transitionScreen
        .classList
        .remove(
            "active"
        );

    transitionScreen
        .setAttribute(
            "aria-hidden",
            "true"
        );


    finalizeAcceptance();

}



/* =========================================================
   FINALIZAÇÃO — MOSTRA A TELA FINAL
========================================================= */

function finalizeAcceptance() {


    finished = true;


    playYesSound();

    stopGameOverDrone();

    stopTensionDrone();


    /*
     * Fecha GAME OVER caso
     * ele esteja aberto.
     */

    gameOverScreen
        .classList
        .remove(
            "active"
        );


    gameOverScreen
        .setAttribute(
            "aria-hidden",
            "true"
        );


    /*
     * Esconde a pergunta.
     */

    questionCard.style.display =
        "none";


    /*
     * Mostra a tela final.
     */

    finalCard.style.display =
        "block";


    /*
     * Remove o modo sombrio.
     */

    document.body
        .classList
        .remove(
            "dark-mode"
        );


    document.documentElement
        .style
        .setProperty(
            "--fire",
            0
        );


    document.documentElement
        .style
        .setProperty(
            "--tension",
            0
        );


    /*
     * Música.
     */

    youtubePlayer.src =

        `https://www.youtube.com/embed/${CONFIG.youtubeVideo}?autoplay=1&rel=0&modestbranding=1`;



    /*
     * Mensagem de estatística.
     */

    if (
        attempts === 0
    ) {

        finalStat.textContent =
            "Resposta rápida. ❤️";

    }

    else {

        finalStat.textContent =

            `Foram ${attempts} tentativa${
                attempts === 1
                    ? ""
                    : "s"
            } de "não" antes do SIM. 😂❤️`;

    }


    /*
     * Efeitos.
     */

    createConfetti();

    createHeartExplosion();


    /*
     * Rola a tela até o topo da tela final,
     * garantindo que o card inteiro (com o
     * vídeo) fique visível e acessível.
     */

    requestAnimationFrame(

        function() {

            finalCard.scrollIntoView({

                behavior: "smooth",

                block: "start"

            });

        }

    );

}



/* =========================================================
   EVENTO DESKTOP
========================================================= */

noButton.addEventListener(

    "mouseenter",

    rejectAttempt

);



/* =========================================================
   EVENTO MOBILE
========================================================= */

noButton.addEventListener(

    "touchstart",

    function(event) {

        event.preventDefault();

        rejectAttempt();

    },

    {
        passive: false
    }

);



/* =========================================================
   CLIQUE NO NÃO
========================================================= */

noButton.addEventListener(

    "click",

    function(event) {

        event.preventDefault();

        rejectAttempt();

    }

);



/* =========================================================
   SIM
========================================================= */

yesButton.addEventListener(

    "click",

    acceptProposal

);


finalYesButton.addEventListener(

    "click",

    acceptProposal

);



/* =========================================================
   CONFETES
========================================================= */

function createConfetti() {


    const emojis = [

        "❤️",
        "💕",
        "💗",
        "💖",
        "💘",
        "🥰",
        "✨",
        "🌹"

    ];


    for (
        let i = 0;
        i < 100;
        i++
    ) {


        const item =
            document.createElement(
                "div"
            );


        item.className =
            "confetti";


        item.textContent =

            emojis[
                Math.floor(
                    Math.random() *
                    emojis.length
                )
            ];


        item.style.left =
            `${Math.random() * 100}vw`;


        item.style.fontSize =
            `${15 + Math.random() * 25}px`;


        item.style.animationDuration =
            `${2 + Math.random() * 4}s`;


        item.style.animationDelay =
            `${Math.random() * 1.5}s`;


        document.body.appendChild(
            item
        );


        setTimeout(

            () => item.remove(),

            7000

        );

    }

}



/* =========================================================
   EXPLOSÃO DE CORAÇÕES
========================================================= */

function createHeartExplosion() {


    const hearts = [

        "❤️",
        "💕",
        "💗",
        "💖",
        "🥰"

    ];


    for (
        let i = 0;
        i < 40;
        i++
    ) {


        const heart =
            document.createElement(
                "div"
            );


        heart.className =
            "explosion-heart";


        heart.textContent =

            hearts[
                Math.floor(
                    Math.random() *
                    hearts.length
                )
            ];


        heart.style.fontSize =
            `${20 + Math.random() * 30}px`;


        document.body.appendChild(
            heart
        );


        const angle =
            Math.random() *
            Math.PI *
            2;


        const distance =
            100 +
            Math.random() * 400;


        const x =
            Math.cos(angle) *
            distance;


        const y =
            Math.sin(angle) *
            distance;


        heart.animate(

            [

                {

                    transform:
                        "translate(-50%, -50%) scale(0)",

                    opacity: 1

                },

                {

                    transform:

                        `translate(
                            calc(-50% + ${x}px),
                            calc(-50% + ${y}px)
                        )
                        scale(1.2)`,

                    opacity: 0

                }

            ],

            {

                duration:
                    1200 +
                    Math.random() * 800,

                easing:
                    "cubic-bezier(.2,.8,.2,1)"

            }

        );


        setTimeout(

            () => heart.remove(),

            2300

        );

    }

}



/* =========================================================
   CORAÇÕES DO FUNDO
========================================================= */

function createBackgroundHeart() {


    if (finished) {

        return;

    }


    const container =
        document.getElementById(
            "backgroundHearts"
        );


    const heart =
        document.createElement(
            "div"
        );


    heart.className =
        "background-heart";


    heart.textContent =

        Math.random() > 0.5
            ? "♡"
            : "♥";


    heart.style.left =
        `${Math.random() * 100}%`;


    heart.style.fontSize =
        `${15 + Math.random() * 30}px`;


    heart.style.animationDuration =
        `${6 + Math.random() * 8}s`;


    container.appendChild(
        heart
    );


    setTimeout(

        () => heart.remove(),

        15000

    );

}



/* =========================================================
   CORAÇÕES AUTOMÁTICOS
========================================================= */

setInterval(

    createBackgroundHeart,

    1200

);



/* =========================================================
   RESIZE
========================================================= */

window.addEventListener(

    "resize",

    function() {


        if (
            !finished &&
            attempts > 0 &&
            attempts <
            CONFIG.gameOverStart
        ) {

            moveNoButton();

        }

    }

);