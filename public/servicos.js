const state = {
    whatsapp: null,
    servicos: [],
    selectedSlot: null,
    setup: {
        whatsapp_configurado: false,
        mercado_pago_configurado: false,
        public_base_url_configurada: false,
        public_base_url_https: false,
        pix_disponivel: false
    }
};

const el = {
    services: document.querySelector('#publicServices'),
    heroWhatsapp: document.querySelector('#heroWhatsapp'),
    bottomWhatsapp: document.querySelector('#bottomWhatsapp'),
    availabilityForm: document.querySelector('#availabilityForm'),
    availabilityDate: document.querySelector('#availabilityDate'),
    availabilityService: document.querySelector('#availabilityService'),
    availabilityGrid: document.querySelector('#availabilityGrid'),
    publicSetupNotice: document.querySelector('#publicSetupNotice'),
    bookingPanel: document.querySelector('#bookingPanel'),
    bookingSummary: document.querySelector('#bookingSummary'),
    bookingForm: document.querySelector('#bookingForm'),
    bookingName: document.querySelector('#bookingName'),
    bookingPhone: document.querySelector('#bookingPhone'),
    bookingEmail: document.querySelector('#bookingEmail'),
    bookingPaymentMethod: document.querySelector('#bookingPaymentMethod'),
    bookingChargeType: document.querySelector('#bookingChargeType'),
    bookingNotes: document.querySelector('#bookingNotes'),
    bookingWhatsapp: document.querySelector('#bookingWhatsapp'),
    bookingSetupHint: document.querySelector('#bookingSetupHint'),
    paymentResult: document.querySelector('#paymentResult'),
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

function dateLong(value) {
    return new Date(value).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
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

async function api(path, options = {}) {
    const response = await fetch(path, {
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        },
        ...options
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.erro || 'Nao foi possivel carregar.');
    return data;
}

function whatsappUrl(servico = null, horario = null, cliente = null) {
    const horarioTexto = horario ? ` no dia ${dateLong(horario)} as ${time(horario)}` : '';
    const clienteTexto = cliente ? `\nNome: ${cliente.nome}\nTelefone: ${cliente.telefone}` : '';
    const message = servico
        ? `Oi, Karina! Vim pelo site e quero marcar ${servico.nome}${horarioTexto}. Pode confirmar disponibilidade?${clienteTexto}`
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

function metodoLabel(value) {
    return ({
        pix_online: 'Pix online',
        cartao_online: 'Cartao online',
        pix_manual: 'Pix manual na hora',
        dinheiro: 'Dinheiro na hora'
    })[value] || value;
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

function metodoOnline() {
    return ['pix_online', 'cartao_online'].includes(el.bookingPaymentMethod.value);
}

function updateBookingModeUI() {
    if (!el.bookingForm) return;
    const metodo = el.bookingPaymentMethod.value;
    const submitButton = el.bookingForm.querySelector('button[type="submit"]');
    const online = metodoOnline();
    el.bookingEmail.required = online;
    el.bookingChargeType.disabled = !online;
    if (!online) el.bookingChargeType.value = 'sinal_30';
    submitButton.textContent = ({
        pix_online: 'Gerar QR Pix',
        cartao_online: 'Abrir pagamento com cartao',
        pix_manual: 'Reservar horario',
        dinheiro: 'Reservar horario'
    })[metodo] || 'Reservar horario';
    submitButton.disabled = online && !state.setup.mercado_pago_configurado;
    el.bookingWhatsapp.disabled = !state.whatsapp;

    const avisos = [];
    if (online && !state.setup.mercado_pago_configurado) {
        avisos.push('Mercado Pago ainda nao configurado para pagamento online.');
    }
    if (!state.whatsapp) {
        avisos.push('WhatsApp sera liberado quando o numero da Karina entrar no .env.');
    }
    el.bookingSetupHint.hidden = !avisos.length;
    el.bookingSetupHint.textContent = avisos.join(' ');
}

function renderSetupNotice() {
    const pendencias = [];
    if (!state.setup.whatsapp_configurado) pendencias.push('WhatsApp');
    if (!state.setup.mercado_pago_configurado) pendencias.push('Mercado Pago');
    if (!pendencias.length) {
        el.publicSetupNotice.hidden = true;
        return;
    }
    el.publicSetupNotice.hidden = false;
    el.publicSetupNotice.textContent = `Integracoes em configuracao: ${pendencias.join(' e ')}. O agendamento manual segue funcionando.`;
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

function selectSlot(slot) {
    state.selectedSlot = slot;
    const servico = selectedAvailabilityService();
    el.bookingSummary.textContent = `${servico.nome} em ${dateLong(slot.inicio)} as ${time(slot.inicio)}.`;
    el.bookingPanel.hidden = false;
    el.paymentResult.hidden = true;
    el.paymentResult.replaceChildren();
    updateBookingModeUI();
    el.bookingPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderAvailability(slots) {
    if (!slots.length) {
        el.availabilityGrid.innerHTML = '<div class="empty-state compact-empty">Nenhum horario para esta data.</div>';
        return;
    }
    const servico = selectedAvailabilityService();
    el.availabilityGrid.replaceChildren(...slots.map((slot) => {
        const item = document.createElement(slot.disponivel ? 'button' : 'span');
        item.className = `availability-slot ${slot.disponivel ? 'available' : 'unavailable'}`;
        if (slot.disponivel) {
            item.type = 'button';
            item.addEventListener('click', () => selectSlot(slot));
            item.setAttribute('aria-label', `Reservar horario das ${time(slot.inicio)}`);
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

function bookingPayload(metodo) {
    if (!state.selectedSlot) throw new Error('Escolha um horario livre.');
    return {
        nome: el.bookingName.value,
        telefone: el.bookingPhone.value,
        email: el.bookingEmail.value,
        servico_id: el.availabilityService.value,
        inicio: state.selectedSlot.inicio,
        tipo_cobranca: metodoOnline() ? el.bookingChargeType.value : 'pagar_na_hora',
        metodo_pagamento_preferido: metodo,
        observacoes: el.bookingNotes.value
    };
}

function renderPixPayment(result) {
    const pix = result.pagamento && result.pagamento.pix;
    if (!pix || !pix.qr_code) {
        showToast('Agendamento criado, mas o QR Pix nao retornou.');
        return;
    }
    el.paymentResult.hidden = false;
    el.paymentResult.innerHTML = `
        <div>
            <strong>QR Pix gerado</strong>
            <p>Horario reservado. Pague pelo QR Code ou copie o codigo Pix.</p>
        </div>
        ${pix.qr_code_base64 ? `<img src="data:image/png;base64,${pix.qr_code_base64}" alt="QR Code Pix Mercado Pago">` : ''}
        <textarea readonly rows="4">${escapeHtml(pix.qr_code)}</textarea>
        <button class="secondary-button" type="button" data-copy-pix>Copiar Pix</button>
    `;
    const copyButton = el.paymentResult.querySelector('[data-copy-pix]');
    copyButton.addEventListener('click', async () => {
        await navigator.clipboard.writeText(pix.qr_code);
        showToast('Codigo Pix copiado.');
    });
}

function renderCardPayment(result) {
    const pagamento = result.pagamento || {};
    const checkoutUrl = pagamento.checkout_url || pagamento.sandbox_checkout_url;
    if (!checkoutUrl) {
        showToast('Agendamento criado, mas o link de pagamento nao retornou.');
        return;
    }
    el.paymentResult.hidden = false;
    el.paymentResult.innerHTML = `
        <div>
            <strong>Pagamento com cartao pronto</strong>
            <p>Horario reservado. Abra o checkout para concluir o pagamento online.</p>
        </div>
        <a class="primary-button payment-link" href="${checkoutUrl}" target="_blank" rel="noopener">Ir para o pagamento</a>
    `;
}

function renderManualReservation(result) {
    el.paymentResult.hidden = false;
    el.paymentResult.innerHTML = `
        <div>
            <strong>Horario reservado</strong>
            <p>Reserva criada com pagamento em ${escapeHtml(metodoLabel(el.bookingPaymentMethod.value).toLowerCase())}.</p>
        </div>
    `;
}

async function init() {
    try {
        const [info, servicos] = await Promise.all([
            api('/api/publico'),
            api('/api/servicos')
        ]);
        state.whatsapp = info.whatsapp;
        state.setup = info.setup || state.setup;
        state.servicos = servicos;
        el.availabilityDate.value = today();
        renderSetupNotice();
        renderHeroAction();
        renderServices();
        renderAvailabilitySelect();
        updateBookingModeUI();
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

if (el.bookingForm) {
    el.bookingForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const metodo = el.bookingPaymentMethod.value;
        if (metodoOnline() && !state.setup.mercado_pago_configurado) {
            showToast('Mercado Pago ainda nao configurado no .env.');
            return;
        }
        try {
            const result = await api('/api/publico/agendamentos', {
                method: 'POST',
                body: JSON.stringify(bookingPayload(metodo))
            });
            if (metodo === 'pix_online') renderPixPayment(result);
            else if (metodo === 'cartao_online') renderCardPayment(result);
            else renderManualReservation(result);
            await loadAvailability();
        } catch (error) {
            showToast(error.message);
        }
    });
}

if (el.bookingPaymentMethod) {
    el.bookingPaymentMethod.addEventListener('change', updateBookingModeUI);
}

if (el.bookingWhatsapp) {
    el.bookingWhatsapp.addEventListener('click', () => {
        try {
            const servico = selectedAvailabilityService();
            const url = whatsappUrl(servico, state.selectedSlot && state.selectedSlot.inicio, {
                nome: el.bookingName.value || 'Cliente pelo site',
                telefone: el.bookingPhone.value || 'nao informado'
            });
            if (!url) {
                showToast('Configure WHATSAPP_BUSINESS_NUMBER no .env.');
                return;
            }
            window.open(url, '_blank', 'noopener');
        } catch (error) {
            showToast(error.message);
        }
    });
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js').catch(() => {});
    });
}

init();
