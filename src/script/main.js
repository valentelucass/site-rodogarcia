function openExternalInNewTab(url) {
    const openedWindow = window.open(url, '_blank', 'noopener,noreferrer');
    if (openedWindow) {
        openedWindow.opener = null;
    }
}

function applyPhoneMask(input) {
    if (!input) {
        return;
    }

    input.addEventListener('input', (event) => {
        let value = event.target.value.replace(/\D/g, '');

        if (value.length > 11) {
            value = value.slice(0, 11);
        }

        if (value.length <= 10) {
            value = value.replace(/(\d{2})(\d{0,4})(\d{0,4})/, (_, ddd, first, second) => {
                if (!first) {
                    return `(${ddd}`;
                }
                if (!second) {
                    return `(${ddd}) ${first}`;
                }
                return `(${ddd}) ${first}-${second}`;
            });
        } else {
            value = value.replace(/(\d{2})(\d{0,5})(\d{0,4})/, (_, ddd, first, second) => {
                if (!first) {
                    return `(${ddd}`;
                }
                if (!second) {
                    return `(${ddd}) ${first}`;
                }
                return `(${ddd}) ${first}-${second}`;
            });
        }

        event.target.value = value;
    });
}

function extractWhatsAppNumber(url) {
    if (!url) {
        return '';
    }

    const match = url.match(/wa\.me\/(\d+)/i);
    return match ? match[1] : '';
}

document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.querySelector('.menu-toggle');
    const navPrincipal = document.querySelector('.nav-principal');
    const fecharMenu = document.querySelector('.fechar-menu');
    const linksMobile = document.querySelectorAll('.nav-principal .link-nav');

    const abrirMenu = () => {
        if (!navPrincipal || !menuToggle) {
            return;
        }

        navPrincipal.classList.add('ativo');
        menuToggle.setAttribute('aria-expanded', 'true');
        document.body.classList.add('menu-aberto');
        document.body.style.overflow = 'hidden';
    };

    const fecharMenuFunc = () => {
        if (navPrincipal) {
            navPrincipal.classList.remove('ativo');
        }
        if (menuToggle) {
            menuToggle.setAttribute('aria-expanded', 'false');
        }
        document.body.classList.remove('menu-aberto');
        document.body.style.overflow = '';
    };

    if (menuToggle && navPrincipal) {
        menuToggle.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();

            if (navPrincipal.classList.contains('ativo')) {
                fecharMenuFunc();
                return;
            }

            abrirMenu();
        });
    }

    if (fecharMenu) {
        fecharMenu.addEventListener('click', (event) => {
            event.preventDefault();
            fecharMenuFunc();
        });
    }

    linksMobile.forEach((link) => {
        link.addEventListener('click', (event) => {
            const href = link.getAttribute('href') || '';

            if (href.startsWith('#')) {
                event.preventDefault();
                const target = document.querySelector(href);
                fecharMenuFunc();

                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
                return;
            }

            fecharMenuFunc();
        });
    });

    document.addEventListener('click', (event) => {
        if (!menuToggle || !navPrincipal) {
            return;
        }

        if (!navPrincipal.classList.contains('ativo')) {
            return;
        }

        if (navPrincipal.contains(event.target) || menuToggle.contains(event.target)) {
            return;
        }

        fecharMenuFunc();
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && navPrincipal && navPrincipal.classList.contains('ativo')) {
            fecharMenuFunc();
        }
    });

    const formsRastreio = document.querySelectorAll('.form-rastreio-row');
    formsRastreio.forEach((form) => {
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            openExternalInNewTab('https://rodogarcia.eslcloud.com.br/recipient_tracking');
        });
    });

    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
        anchor.addEventListener('click', function (event) {
            const href = this.getAttribute('href');
            if (!href || href === '#') {
                return;
            }

            const target = document.querySelector(href);
            if (!target) {
                return;
            }

            event.preventDefault();
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        });
    });

    document.querySelectorAll('input[type="tel"]').forEach((input) => {
        applyPhoneMask(input);
    });

    const formCotacao = document.getElementById('formCotacao');
    if (formCotacao) {
        const whatsappButtons = document.querySelectorAll('.whatsapp-cards .whatsapp-button');
        const whatsappNumbers = {
            fracionada: extractWhatsAppNumber(whatsappButtons[0] ? whatsappButtons[0].getAttribute('href') : ''),
            fechada: extractWhatsAppNumber(whatsappButtons[1] ? whatsappButtons[1].getAttribute('href') : '')
        };

        formCotacao.addEventListener('submit', (event) => {
            event.preventDefault();

            const formData = new FormData(formCotacao);
            const dados = {
                nome: formData.get('nome'),
                email: formData.get('email'),
                telefone: formData.get('telefone'),
                empresa: formData.get('empresa') || 'Nao informado',
                origem: formData.get('origem'),
                destino: formData.get('destino'),
                tipoCarga: formData.get('tipo-carga'),
                peso: formData.get('peso'),
                comprimento: formData.get('comprimento') || 'Nao informado',
                largura: formData.get('largura') || 'Nao informado',
                altura: formData.get('altura') || 'Nao informado',
                quantidade: formData.get('quantidade') || 'Nao informado',
                observacoes: formData.get('observacoes') || 'Nenhuma observacao'
            };

            const numeroWhatsApp =
                dados.tipoCarga === 'fechada'
                    ? (whatsappNumbers.fechada || '5514999999999')
                    : (whatsappNumbers.fracionada || '5514999999999');

            const tipoCargaTexto = dados.tipoCarga === 'fracionada' ? 'Carga Fracionada' : 'Carga Fechada';
            const mensagem =
                '*Nova Solicitacao de Cotacao*\n\n' +
                '*Dados Pessoais:*\n' +
                `Nome: ${dados.nome}\n` +
                `E-mail: ${dados.email}\n` +
                `Telefone: ${dados.telefone}\n` +
                `Empresa: ${dados.empresa}\n\n` +
                '*Origem e Destino:*\n' +
                `Origem: ${dados.origem}\n` +
                `Destino: ${dados.destino}\n` +
                `Tipo de Carga: ${tipoCargaTexto}\n\n` +
                '*Dimensoes e Peso:*\n' +
                `Peso: ${dados.peso} kg\n` +
                `Comprimento: ${dados.comprimento} cm\n` +
                `Largura: ${dados.largura} cm\n` +
                `Altura: ${dados.altura} cm\n` +
                `Quantidade de Volumes: ${dados.quantidade}\n\n` +
                `*Observacoes:*\n${dados.observacoes}`;

            const mensagemEncoded = encodeURIComponent(mensagem);
            const urlWhatsApp = `https://wa.me/${numeroWhatsApp}?text=${mensagemEncoded}`;
            openExternalInNewTab(urlWhatsApp);
        });
    }
});
