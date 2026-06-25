const state = {
    clientes: [],
    servicos: [],
    agendamentos: [],
    resumo: null,
    adminProtegido: false,
    adminToken: localStorage.getItem('adminToken') || ''
};

const el = {
    selectedDate: document.querySelector('#selectedDate'),
    prevDay: document.querySelector('#prevDay'),
    nextDay: document.querySelector('#nextDay'),
    refreshButton: document.querySelector('#refreshButton'),
    dayLabel: document.querySelector('#dayLabel'),
    summaryGrid: document.querySelector('#summaryGrid'),
    appointmentsList: document.querySelector('#appointmentsList'),
    appointmentForm: document.querySelector('#appointmentForm'),
    appointmentClient: document.querySelector('#appointmentClient'),
    appointmentService: document.querySelector('#appointmentService'),
    appointmentTime: document.querySelector('#appointmentTime'),
    appointmentCustomTime: document.querySelector('#appointmentCustomTime'),
    appointmentNotes: document.querySelector('#appointmentNotes'),
    clientForm: document.querySelector('#clientForm'),
    clientName: document.querySelector('#clientName'),
    clientPhone: document.querySelector('#clientPhone'),
    serviceForm: document.querySelector('#serviceForm'),
    serviceName: document.querySelector('#serviceName'),
    serviceDuration: document.querySelector('#serviceDuration'),
    servicePrice: document.querySelector('#servicePrice'),
    adminLogin: document.querySelector('#adminLogin'),
    adminLoginForm: document.querySelector('#adminLoginForm'),
    adminToken: document.querySelector('#adminToken'),
    toast: document.querySelector('#toast')
};

function today() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 10);
}

function addDays(dateText, amount) {
    const date = new Date(`${dateText}T12:00:00`);
    date.setDate(date.getDate() + amount);
    return date.toISOString().slice(0, 10);
}

function startOfDay(dateText) {
    return `${dateText}T00:00:00-03:00`;
}

function nextDayStart(dateText) {
    return `${addDays(dateText, 1)}T00:00:00-03:00`;
}

function currency(value) {
    return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function time(value) {
    return new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function dateLong(dateText) {
    const date = new Date(`${dateText}T12:00:00`);
    return date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
}

function showToast(message) {
    el.toast.textContent = message;
    el.toast.classList.add('visible');
    clearTimeout(showToast.timeout);
    showToast.timeout = setTimeout(() => el.toast.classList.remove('visible'), 3200);
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

async function api(path, options = {}) {
    const response = await fetch(path, {
        headers: {
            'Content-Type': 'application/json',
            ...(state.adminToken ? { 'X-Admin-Token': state.adminToken } : {}),
            ...(options.headers || {})
        },
        ...options
    });
    if (response.status === 204) return null;
    const data = await response.json();
    if (!response.ok) {
        const error = new Error(data.erro || 'Nao foi possivel completar a acao.');
        error.status = response.status;
        error.details = data.detalhes || {};
        if (response.status === 401) showLogin();
        throw error;
    }
    return data;
}

function showLogin() {
    if (!el.adminLogin) return;
    el.adminLogin.hidden = false;
    document.body.classList.add('login-open');
    if (el.adminToken) el.adminToken.focus();
}

function hideLogin() {
    if (!el.adminLogin) return;
    el.adminLogin.hidden = true;
    document.body.classList.remove('login-open');
}

function option(value, label) {
    const node = document.createElement('option');
    node.value = value;
    node.textContent = label;
    return node;
}

function renderSelects() {
    el.appointmentClient.replaceChildren(
        option('', state.clientes.length ? 'Selecione' : 'Cadastre uma cliente'),
        ...state.clientes.map((cliente) => option(cliente.id, `${cliente.nome} - ${cliente.telefone}`))
    );
    el.appointmentService.replaceChildren(
        option('', state.servicos.length ? 'Selecione' : 'Cadastre um servico'),
        ...state.servicos.map((servico) => option(
            servico.id,
            `${servico.nome} - ${servico.duracao_minutos} min - ${currency(servico.preco)}`
        ))
    );
}

async function loadTimes() {
    const servicoId = el.appointmentService.value;
    if (!servicoId) {
        el.appointmentTime.replaceChildren(option('', 'Escolha um servico'));
        return;
    }
    const horarios = await api(`/api/disponibilidade?data=${el.selectedDate.value}&servico_id=${servicoId}`);
    el.appointmentTime.replaceChildren(
        option('', horarios.length ? 'Selecione' : 'Sem horarios livres'),
        ...horarios.map((inicio) => option(inicio, time(inicio)))
    );
}

function selectedStart() {
    if (el.appointmentCustomTime.value) {
        return `${el.selectedDate.value}T${el.appointmentCustomTime.value}:00-03:00`;
    }
    return el.appointmentTime.value;
}

function renderSummary() {
    const resumo = state.resumo || { total: 0, concluidos: 0, faturamento: 0, cancelados: 0 };
    el.summaryGrid.innerHTML = `
        <div><strong>${resumo.total}</strong><span>marcados</span></div>
        <div><strong>${resumo.concluidos}</strong><span>concluidos</span></div>
        <div><strong>${currency(resumo.faturamento)}</strong><span>faturado</span></div>
        <div><strong>${resumo.cancelados}</strong><span>cancelados</span></div>
    `;
}

function actionButton(text, className, handler) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = text;
    button.addEventListener('click', handler);
    return button;
}

function renderAppointments() {
    el.dayLabel.textContent = dateLong(el.selectedDate.value);
    if (!state.agendamentos.length) {
        el.appointmentsList.innerHTML = '<div class="empty-state">Nenhum horario marcado para este dia.</div>';
        return;
    }

    el.appointmentsList.replaceChildren(...state.agendamentos.map((agendamento) => {
        const row = document.createElement('article');
        row.className = `appointment ${agendamento.status}`;
        const statusClass = ['cancelado', 'faltou'].includes(agendamento.status) ? agendamento.status : '';
        row.innerHTML = `
            <div class="time">${time(agendamento.inicio)}</div>
            <div>
                <h3>${escapeHtml(agendamento.cliente_nome)}</h3>
                <p>${escapeHtml(agendamento.servico_nome)} - ${currency(agendamento.preco)}</p>
                ${agendamento.observacoes ? `<p>${escapeHtml(agendamento.observacoes)}</p>` : ''}
                <div class="status-row">
                    <span class="pill ${statusClass}">${escapeHtml(agendamento.status)}</span>
                    ${agendamento.encaixe ? '<span class="pill encaixe">encaixe</span>' : ''}
                    <span class="pill pagamento">${escapeHtml(agendamento.pagamento_status || 'pendente')}</span>
                    <span class="pill">${time(agendamento.inicio)} as ${time(agendamento.fim)}</span>
                </div>
            </div>
        `;
        const actions = document.createElement('div');
        actions.className = 'actions';
        if (!['concluido', 'cancelado', 'faltou'].includes(agendamento.status)) {
            actions.append(
                actionButton('Confirmar', 'secondary-button', () => updateStatus(agendamento.id, 'confirmado')),
                actionButton('Concluir', 'primary-button', () => updateStatus(agendamento.id, 'concluido')),
                actionButton('Cancelar', 'danger-button', () => updateStatus(agendamento.id, 'cancelado'))
            );
        }
        actions.append(actionButton('Excluir', 'danger-button outline-danger', () => deleteAppointment(agendamento)));
        row.append(actions);
        return row;
    }));
}

async function updateStatus(id, status) {
    try {
        await api(`/api/agendamentos/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ status })
        });
        showToast('Agendamento atualizado.');
        await loadDay();
    } catch (error) {
        showToast(error.message);
    }
}

async function deleteAppointment(agendamento) {
    const confirma = window.confirm(
        `Excluir o horario de ${agendamento.cliente_nome} as ${time(agendamento.inicio)}?\n\nEssa acao remove o agendamento da agenda.`
    );
    if (!confirma) return;
    try {
        await api(`/api/agendamentos/${agendamento.id}`, { method: 'DELETE' });
        showToast('Horario excluido.');
        await loadDay();
    } catch (error) {
        showToast(error.message);
    }
}

async function loadDay() {
    const date = el.selectedDate.value;
    const [agendamentos, resumo] = await Promise.all([
        api(`/api/agendamentos?inicio=${encodeURIComponent(startOfDay(date))}&fim=${encodeURIComponent(nextDayStart(date))}`),
        api(`/api/resumo?data=${date}`)
    ]);
    state.agendamentos = agendamentos;
    state.resumo = resumo;
    renderSummary();
    renderAppointments();
    await loadTimes();
}

async function loadBaseData() {
    const [clientes, servicos] = await Promise.all([
        api('/api/clientes'),
        api('/api/servicos')
    ]);
    state.clientes = clientes;
    state.servicos = servicos;
    renderSelects();
}

async function refreshAll() {
    try {
        await loadBaseData();
        await loadDay();
    } catch (error) {
        showToast(error.message);
    }
}

async function checkAdminAccess() {
    const status = await api('/api/admin/status');
    state.adminProtegido = status.protegido;
    if (state.adminProtegido && !state.adminToken) {
        showLogin();
        return false;
    }
    hideLogin();
    return true;
}

el.prevDay.addEventListener('click', () => {
    el.selectedDate.value = addDays(el.selectedDate.value, -1);
    loadDay().catch((error) => showToast(error.message));
});

el.nextDay.addEventListener('click', () => {
    el.selectedDate.value = addDays(el.selectedDate.value, 1);
    loadDay().catch((error) => showToast(error.message));
});

el.selectedDate.addEventListener('change', () => loadDay().catch((error) => showToast(error.message)));
el.refreshButton.addEventListener('click', refreshAll);
el.appointmentService.addEventListener('change', () => loadTimes().catch((error) => showToast(error.message)));
el.appointmentCustomTime.addEventListener('input', () => {
    el.appointmentTime.required = !el.appointmentCustomTime.value;
});

el.appointmentForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const baseBody = {
        cliente_id: el.appointmentClient.value,
        servico_id: el.appointmentService.value,
        inicio: selectedStart(),
        observacoes: el.appointmentNotes.value
    };
    try {
        await api('/api/agendamentos', {
            method: 'POST',
            body: JSON.stringify(baseBody)
        });
        el.appointmentNotes.value = '';
        el.appointmentCustomTime.value = '';
        el.appointmentTime.required = true;
        showToast('Horario agendado.');
        await loadDay();
    } catch (error) {
        if (error.status === 409 && error.details.pode_confirmar_encaixe) {
            const conflito = error.details.conflito;
            const confirma = window.confirm(
                `Esse horario conflita com ${conflito.cliente_nome} das ${time(conflito.inicio)} as ${time(conflito.fim)}.\n\nTem certeza que deseja encaixar mesmo assim?`
            );
            if (!confirma) {
                showToast('Encaixe cancelado.');
                return;
            }
            try {
                await api('/api/agendamentos', {
                    method: 'POST',
                    body: JSON.stringify({
                        ...baseBody,
                        permitir_conflito: true,
                        motivo_encaixe: 'Confirmado manualmente no painel'
                    })
                });
                el.appointmentNotes.value = '';
                el.appointmentCustomTime.value = '';
                el.appointmentTime.required = true;
                showToast('Encaixe agendado.');
                await loadDay();
                return;
            } catch (confirmError) {
                showToast(confirmError.message);
                return;
            }
        }
        showToast(error.message);
    }
});

el.clientForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
        const cliente = await api('/api/clientes', {
            method: 'POST',
            body: JSON.stringify({
                nome: el.clientName.value,
                telefone: el.clientPhone.value
            })
        });
        el.clientForm.reset();
        showToast('Cliente salvo.');
        await loadBaseData();
        el.appointmentClient.value = cliente.id;
    } catch (error) {
        showToast(error.message);
    }
});

el.serviceForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
        const servico = await api('/api/servicos', {
            method: 'POST',
            body: JSON.stringify({
                nome: el.serviceName.value,
                duracao_minutos: Number(el.serviceDuration.value),
                preco: Number(el.servicePrice.value)
            })
        });
        el.serviceForm.reset();
        el.serviceDuration.value = 60;
        showToast('Servico salvo.');
        await loadBaseData();
        el.appointmentService.value = servico.id;
        await loadTimes();
    } catch (error) {
        showToast(error.message);
    }
});

if (el.adminLoginForm) {
    el.adminLoginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        state.adminToken = el.adminToken.value.trim();
        localStorage.setItem('adminToken', state.adminToken);
        try {
            await refreshAll();
            hideLogin();
            showToast('Acesso liberado.');
        } catch (error) {
            localStorage.removeItem('adminToken');
            state.adminToken = '';
            showLogin();
            showToast(error.message);
        }
    });
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js').catch(() => {});
    });
}

el.selectedDate.value = today();
checkAdminAccess().then((ok) => {
    if (ok) refreshAll();
}).catch((error) => showToast(error.message));
