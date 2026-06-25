const state = {
    whatsapp: null,
    servicos: []
};

const el = {
    services: document.querySelector('#publicServices'),
    heroWhatsapp: document.querySelector('#heroWhatsapp'),
    bottomWhatsapp: document.querySelector('#bottomWhatsapp'),
    toast: document.querySelector('#toast')
};

function currency(value) {
    return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    }[char]));
}

function showToast(message) {
    el.toast.textContent = message;
    el.toast.classList.add('visible');
    clearTimeout(showToast.timeout);
    showToast.timeout = setTimeout(() => el.toast.classList.remove('visible'), 3200);
}

async function api(path) {
    const response = await fetch(path);
    const data = await response.json();
    if (!response.ok) throw new Error(data.erro || 'Nao foi possivel carregar.');
    return data;
}

function whatsappUrl(servico = null) {
    const message = servico
        ? `Oi, Karina! Vim pelo site e quero marcar ${servico.nome}. Pode me passar os horarios disponiveis?`
        : 'Oi, Karina! Vim pelo site e quero marcar um horario.';
    if (!state.whatsapp) return null;
    return `https://wa.me/${state.whatsapp}?text=${encodeURIComponent(message)}`;
}

function renderHeroAction() {
    const url = whatsappUrl();
    if (!url) {
        el.heroWhatsapp.href = '#servicos';
        el.heroWhatsapp.textContent = 'Ver servicos';
        if (el.bottomWhatsapp) {
            el.bottomWhatsapp.href = '#servicos';
            el.bottomWhatsapp.textContent = 'Ver servicos';
        }
        return;
    }
    el.heroWhatsapp.href = url;
    el.heroWhatsapp.target = '_blank';
    el.heroWhatsapp.rel = 'noopener';
    if (el.bottomWhatsapp) {
        el.bottomWhatsapp.href = url;
        el.bottomWhatsapp.target = '_blank';
        el.bottomWhatsapp.rel = 'noopener';
    }
}

function serviceCard(servico) {
    const article = document.createElement('article');
    article.className = 'service-card';
    const url = whatsappUrl(servico);
    article.innerHTML = `
        <div class="service-meta">
            <span>${escapeHtml(servico.categoria || 'Unhas')}</span>
            <strong>${servico.duracao_minutos} min</strong>
        </div>
        <h3>${escapeHtml(servico.nome)}</h3>
        <p>${escapeHtml(servico.descricao || 'Servico de unhas com atendimento personalizado.')}</p>
        <div class="service-bottom">
            <strong>${currency(servico.preco)}</strong>
            ${
                url
                    ? `<a class="primary-button service-button" href="${url}" target="_blank" rel="noopener">Marcar</a>`
                    : '<button class="secondary-button service-button" type="button" data-disabled-whatsapp>Marcar</button>'
            }
        </div>
    `;
    const disabled = article.querySelector('[data-disabled-whatsapp]');
    if (disabled) disabled.addEventListener('click', () => showToast('Configure WHATSAPP_BUSINESS_NUMBER no .env.'));
    return article;
}

function renderServices() {
    if (!state.servicos.length) {
        el.services.innerHTML = '<div class="empty-state">Nenhum servico ativo cadastrado.</div>';
        return;
    }
    el.services.replaceChildren(...state.servicos.map(serviceCard));
}

async function init() {
    try {
        const [info, servicos] = await Promise.all([
            api('/api/publico'),
            api('/api/servicos')
        ]);
        state.whatsapp = info.whatsapp;
        state.servicos = servicos;
        renderHeroAction();
        renderServices();
    } catch (error) {
        showToast(error.message);
    }
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js').catch(() => {});
    });
}

init();
