const state = {
    whatsapp: null,
    servicos: []
};

const el = {
    services: document.querySelector('#publicServices'),
    heroWhatsapp: document.querySelector('#heroWhatsapp'),
    bottomWhatsapp: document.querySelector('#bottomWhatsapp'),
    availabilityForm: document.querySelector('#availabilityForm'),
    availabilityDate: document.querySelector('#availabilityDate'),
    availabilityService: document.querySelector('#availabilityService'),
    availabilityGrid: document.querySelector('#availabilityGrid'),
    toast: document.querySelector('#toast')
};

function today() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 10);
}

function currency(value) {
    return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function time(value) {
    return new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
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

function whatsappUrl(servico = null, horario = null) {
    const horarioTexto = horario ? ` no horario das ${time(horario)}` : '';
    const message = servico
        ? `Oi, Karina! Vim pelo site e quero marcar ${servico.nome}${horarioTexto}. Pode confirmar disponibilidade?`
        : 'Oi, Karina! Vim pelo site e quero marcar um horario.';
    if (!state.whatsapp) return null;
    return `https://wa.me/${state.whatsapp}?text=${encodeURIComponent(message)}`;
}

function option(value, label) {
    const node = document.createElement('option');
    node.value = value;
    node.textContent = label;
    return node;
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

function renderAvailabilitySelect() {
    if (!el.availabilityService) return;
    el.availabilityService.replaceChildren(
        option('', state.servicos.length ? 'Selecione' : 'Nenhum servico ativo'),
        ...state.servicos.map((servico) => option(servico.id, `${servico.nome} - ${currency(servico.preco)}`))
    );
}

function selectedAvailabilityService() {
    return state.servicos.find((servico) => String(servico.id) === String(el.availabilityService.value)) || null;
}

function renderAvailability(slots) {
    if (!slots.length) {
        el.availabilityGrid.innerHTML = '<div class="empty-state compact-empty">Nenhum horario para esta data.</div>';
        return;
    }
    const servico = selectedAvailabilityService();
    el.availabilityGrid.replaceChildren(...slots.map((slot) => {
        const item = document.createElement(slot.disponivel && state.whatsapp ? 'a' : 'span');
        item.className = `availability-slot ${slot.disponivel ? 'available' : 'unavailable'}`;
        if (slot.disponivel && state.whatsapp) {
            item.href = whatsappUrl(servico, slot.inicio);
            item.target = '_blank';
            item.rel = 'noopener';
            item.setAttribute('aria-label', `Chamar no WhatsApp para ${time(slot.inicio)}`);
        }
        item.innerHTML = `
            <strong>${time(slot.inicio)}</strong>
            <small>${slot.disponivel ? 'Livre' : 'Indisponivel'}</small>
        `;
        return item;
    }));
}

async function loadAvailability() {
    if (!el.availabilityDate.value || !el.availabilityService.value) {
        el.availabilityGrid.innerHTML = '<div class="empty-state compact-empty">Escolha data e servico para ver horarios.</div>';
        return;
    }
    const slots = await api(
        `/api/disponibilidade/grade?data=${el.availabilityDate.value}&servico_id=${el.availabilityService.value}`
    );
    renderAvailability(slots);
}

async function init() {
    try {
        const [info, servicos] = await Promise.all([
            api('/api/publico'),
            api('/api/servicos')
        ]);
        state.whatsapp = info.whatsapp;
        state.servicos = servicos;
        el.availabilityDate.value = today();
        renderHeroAction();
        renderServices();
        renderAvailabilitySelect();
        if (state.servicos.length) {
            el.availabilityService.value = state.servicos[0].id;
            await loadAvailability();
        }
    } catch (error) {
        showToast(error.message);
    }
}

if (el.availabilityForm) {
    el.availabilityForm.addEventListener('submit', (event) => {
        event.preventDefault();
        loadAvailability().catch((error) => showToast(error.message));
    });
    el.availabilityDate.addEventListener('change', () => loadAvailability().catch((error) => showToast(error.message)));
    el.availabilityService.addEventListener('change', () => loadAvailability().catch((error) => showToast(error.message)));
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js').catch(() => {});
    });
}

init();
