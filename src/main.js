import * as api from './services/api.js';

// ===== State =====
let state = {
  tools: [],
  configs: {},
  selectedTool: 'all',
  templates: {}
};

// ===== Toast Notifications =====
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      ${type === 'success' ? '<path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>' :
      type === 'error' ? '<path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/><path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z"/>' :
        '<path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/><path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>'}
    </svg>
    <span>${message}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 200);
  }, 3000);
}

// ===== Modal Management =====
function openModal(content) {
  const overlay = document.getElementById('modal-overlay');
  const modal = document.getElementById('modal');
  modal.innerHTML = content;
  overlay.classList.add('active');

  // Close on overlay click
  overlay.onclick = (e) => {
    if (e.target === overlay) closeModal();
  };

  // Close on escape
  document.addEventListener('keydown', handleEscapeKey);
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
  document.removeEventListener('keydown', handleEscapeKey);
}

function handleEscapeKey(e) {
  if (e.key === 'Escape') closeModal();
}

// ===== Render Functions =====
function renderToolTabs() {
  const container = document.getElementById('tool-tabs');

  // Count servers per tool
  const counts = { all: 0 };
  let existsCount = 0;
  for (const [tool, servers] of Object.entries(state.configs)) {
    if (!Array.isArray(servers)) continue;
    counts[tool] = servers.length;
    counts.all += servers.length;
  }

  // Count tools with existing configs
  for (const t of state.tools) {
    if (t.exists) existsCount++;
  }

  const tabs = [
    { id: 'all', name: 'All Tools', count: counts.all, exists: true, isAll: true },
    ...state.tools.map(t => ({
      id: t.name,
      name: t.displayName,
      count: counts[t.name] || 0,
      exists: t.exists
    }))
  ];

  container.innerHTML = tabs.map(tab => `
    <button class="tool-tab ${state.selectedTool === tab.id ? 'active' : ''} ${!tab.exists && !tab.isAll ? 'not-found' : ''}" 
            data-tool="${tab.id}" title="${!tab.exists && !tab.isAll ? 'Config file not found' : ''}">
      ${!tab.isAll ? `<span class="status-dot ${tab.exists ? 'exists' : 'missing'}"></span>` : ''}
      ${tab.name}
      <span class="count">${tab.count}</span>
    </button>
  `).join('');

  // Add click handlers
  container.querySelectorAll('.tool-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      state.selectedTool = btn.dataset.tool;
      renderToolTabs();
      renderServerList();
      updateToolName();
    });
  });
}

function updateToolName() {
  const nameEl = document.getElementById('current-tool-name');
  if (state.selectedTool === 'all') {
    nameEl.textContent = 'All Servers';
  } else {
    const tool = state.tools.find(t => t.name === state.selectedTool);
    nameEl.textContent = tool ? `${tool.displayName} Servers` : 'Servers';
  }
}

function renderStats() {
  let total = 0, active = 0;
  for (const servers of Object.values(state.configs)) {
    if (!Array.isArray(servers)) continue;
    total += servers.length;
    active += servers.filter(s => s.enabled).length;
  }

  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-active').textContent = active;
  document.getElementById('stat-tools').textContent = state.tools.length;
}

function renderServerList() {
  const container = document.getElementById('server-list');

  // Collect servers based on selection
  let servers = [];
  if (state.selectedTool === 'all') {
    // Group servers by name
    const groups = {};
    for (const [tool, toolServers] of Object.entries(state.configs)) {
      if (!Array.isArray(toolServers)) continue;

      toolServers.forEach(s => {
        if (!groups[s.name]) {
          groups[s.name] = {
            ...s,
            tools: [],
            instances: []
          };
        }
        groups[s.name].tools.push(tool);
        groups[s.name].instances.push({ ...s, tool });
      });
    }

    // Convert to array
    servers = Object.values(groups).map(g => ({
      ...g,
      // If mixed enabled state, default to true if any is enabled
      enabled: g.instances.some(i => i.enabled),
      // Keep track if it's a group (more than 1 tool)
      isGroup: g.tools.length > 1
    }));
  } else {
    const toolServers = state.configs[state.selectedTool];
    if (Array.isArray(toolServers)) {
      servers = toolServers.map(s => ({ ...s, tool: state.selectedTool, tools: [state.selectedTool] }));
    }
  }

  if (servers.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg width="64" height="64" viewBox="0 0 16 16" fill="currentColor">
          <path d="M6 12.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5ZM3 8.062C3 6.76 4.235 5.765 5.53 5.886a26.58 26.58 0 0 0 4.94 0C11.765 5.765 13 6.76 13 8.062v1.157a.933.933 0 0 1-.765.935c-.845.147-2.34.346-4.235.346-1.895 0-3.39-.2-4.235-.346A.933.933 0 0 1 3 9.219V8.062Zm4.542-.827a.25.25 0 0 0-.217.068l-.92.9a24.767 24.767 0 0 1-1.871-.183.25.25 0 0 0-.068.495c.55.076 1.232.149 2.02.193a.25.25 0 0 0 .189-.071l.754-.736.847 1.71a.25.25 0 0 0 .404.062l.932-.97a25.286 25.286 0 0 0 1.922-.188.25.25 0 0 0-.068-.495c-.538.074-1.207.145-1.98.189a.25.25 0 0 0-.166.076l-.754.785-.842-1.7a.25.25 0 0 0-.182-.135Z"/>
          <path d="M8.5 1.866a1 1 0 1 0-1 0V3h-2A4.5 4.5 0 0 0 1 7.5V8a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1v1a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1v-.5A4.5 4.5 0 0 0 10.5 3h-2V1.866ZM14 7.5V13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7.5A3.5 3.5 0 0 1 5.5 4h5A3.5 3.5 0 0 1 14 7.5Z"/>
        </svg>
        <h3>No MCP Servers</h3>
        <p>Add your first MCP server to get started</p>
        <button class="btn btn-primary" onclick="window.openAddServerModal()">
          Add Server
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = servers.map(server => {
    // Generate badges HTML
    const badgesHtml = server.tools.map(t => {
      const toolInfo = state.tools.find(x => x.name === t);
      return `<span class="server-tool-badge">${toolInfo?.displayName || t}</span>`;
    }).join('');

    // Determine action handlers
    const toggleHandler = server.isGroup
      ? `window.toggleGroupedServer('${escapeHtml(server.name)}', '${server.tools.join(',')}')`
      : `window.toggleServer('${server.tools[0]}', '${escapeHtml(server.name)}')`;

    const deleteHandler = server.isGroup
      ? `window.deleteGroupedServer('${escapeHtml(server.name)}', '${server.tools.join(',')}')`
      : `window.deleteServer('${server.tools[0]}', '${escapeHtml(server.name)}')`;

    // For edit/copy/install, just use the first tool/instance
    const primaryTool = server.tools[0];

    return `
      <div class="server-card ${server.enabled ? '' : 'disabled'}" data-name="${server.name}">
        <div class="server-status"></div>
        <div class="server-info">
          <div class="server-name">${escapeHtml(server.name)}</div>
          <div class="server-meta">
            <span class="server-meta-item badges-container">
              ${badgesHtml}
            </span>
            <span class="server-meta-item">
              ${server.type === 'stdio' ? '⚡ stdio' : '🌐 sse'}
            </span>
            ${server.command ? `
              <span class="server-meta-item server-command" title="${escapeHtml(server.command + ' ' + (server.args || []).join(' '))}">
                ${escapeHtml(server.command)}
              </span>
            ` : ''}
          </div>
        </div>
        <div class="server-actions">
          <button class="btn btn-secondary btn-icon" title="Copy JSON" onclick="window.copyServerJson('${primaryTool}', '${escapeHtml(server.name)}')">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
              <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>
            </svg>
          </button>
          <button class="btn btn-secondary btn-icon" title="Install to..." onclick="window.openInstallToModal('${primaryTool}', '${escapeHtml(server.name)}')">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M1 8a.5.5 0 0 1 .5-.5h11.793l-3.147-3.146a.5.5 0 0 1 .708-.708l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 0 1-.708-.708L13.293 8.5H1.5A.5.5 0 0 1 1 8z"/>
            </svg>
          </button>
          <button class="btn btn-secondary btn-icon" title="Toggle" onclick="${toggleHandler}">
            ${server.enabled ?
        '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M5 3a5 5 0 0 0 0 10h6a5 5 0 0 0 0-10H5zm6 9a4 4 0 1 1 0-8 4 4 0 0 1 0 8z"/></svg>' :
        '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M11 4a4 4 0 0 1 0 8H8a4.992 4.992 0 0 0 2-4 4.992 4.992 0 0 0-2-4h3zm-6 8a4 4 0 1 1 0-8 4 4 0 0 1 0 8zM0 8a5 5 0 0 0 5 5h6a5 5 0 0 0 0-10H5a5 5 0 0 0-5 5z"/></svg>'}
          </button>
          <button class="btn btn-secondary btn-icon" title="Edit" onclick="window.openEditServerModal('${primaryTool}', '${escapeHtml(server.name)}')">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
            </svg>
          </button>
          <button class="btn btn-danger btn-icon" title="Delete" onclick="${deleteHandler}">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
              <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ===== Server Modal =====
function getServerModalHtml(server = null, tool = null) {
  const isEdit = !!server;
  const title = isEdit ? 'Edit MCP Server' : 'Add MCP Server';

  return `
    <div class="modal-header">
      <h3>${title}</h3>
      <button class="modal-close" onclick="window.closeModal()">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
        </svg>
      </button>
    </div>
    <div class="modal-body">
      ${!isEdit ? `
        <div class="form-group">
          <label class="form-label">Use Template</label>
          <div class="template-grid" id="template-grid">
            ${Object.entries(state.templates).map(([key, tmpl]) => `
              <div class="template-card" data-template="${key}">
                <div class="template-name">${tmpl.name}</div>
                <div class="template-desc">${tmpl.description}</div>
              </div>
            `).join('')}
          </div>
        </div>
        <hr style="margin: 1rem 0; border: none; border-top: 1px solid var(--border-color);">
      ` : ''}
      
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Target Tool</label>
          <select class="form-select" id="server-tool" ${isEdit ? 'disabled' : ''}>
            ${state.tools.map(t => `
              <option value="${t.name}" ${tool === t.name ? 'selected' : ''}>${t.displayName}</option>
            `).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Server Name</label>
          <input type="text" class="form-input" id="server-name" 
                 value="${server?.name || ''}" 
                 placeholder="my-server" ${isEdit ? 'readonly' : ''}>
        </div>
      </div>
      
      <div class="form-group">
        <label class="form-label">Type</label>
        <select class="form-select" id="server-type">
          <option value="stdio" ${server?.type !== 'sse' ? 'selected' : ''}>stdio (Command)</option>
          <option value="sse" ${server?.type === 'sse' ? 'selected' : ''}>SSE (URL)</option>
        </select>
      </div>
      
      <div id="stdio-fields" class="${server?.type === 'sse' ? 'hidden' : ''}">
        <div class="form-group">
          <label class="form-label">Command</label>
          <input type="text" class="form-input" id="server-command" 
                 value="${server?.command || ''}" placeholder="npx">
        </div>
        <div class="form-group">
          <label class="form-label">Arguments (one per line)</label>
          <textarea class="form-textarea" id="server-args" placeholder="-y&#10;@modelcontextprotocol/server-filesystem">${(server?.args || []).join('\n')}</textarea>
        </div>
      </div>
      
      <div id="sse-fields" class="${server?.type !== 'sse' ? 'hidden' : ''}">
        <div class="form-group">
          <label class="form-label">URL</label>
          <input type="text" class="form-input" id="server-url" 
                 value="${server?.url || ''}" placeholder="http://localhost:3001/sse">
        </div>
      </div>
      
      <div class="form-group">
        <label class="form-label">Environment Variables (KEY=VALUE, one per line)</label>
        <textarea class="form-textarea" id="server-env" placeholder="GITHUB_TOKEN=xxx">${Object.entries(server?.env || {}).map(([k, v]) => `${k}=${v}`).join('\n')}</textarea>
      </div>
      
      <div class="form-group">
        <label class="toggle">
          <input type="checkbox" class="toggle-input" id="server-enabled" ${server?.enabled !== false ? 'checked' : ''}>
          <span class="toggle-slider"></span>
          <span class="toggle-label">Enabled</span>
        </label>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="window.closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="window.saveServer(${isEdit})">
        ${isEdit ? 'Save Changes' : 'Add Server'}
      </button>
    </div>
  `;
}

window.openAddServerModal = function () {
  openModal(getServerModalHtml(null, state.selectedTool !== 'all' ? state.selectedTool : state.tools[0]?.name));
  setupServerModalHandlers();
};

window.openEditServerModal = function (tool, name) {
  const servers = state.configs[tool];
  const server = servers?.find(s => s.name === name);
  if (server) {
    openModal(getServerModalHtml(server, tool));
    setupServerModalHandlers();
  }
};

function setupServerModalHandlers() {
  // Type toggle
  document.getElementById('server-type')?.addEventListener('change', (e) => {
    const isStdio = e.target.value === 'stdio';
    document.getElementById('stdio-fields').classList.toggle('hidden', !isStdio);
    document.getElementById('sse-fields').classList.toggle('hidden', isStdio);
  });

  // Template selection
  document.querySelectorAll('.template-card').forEach(card => {
    card.addEventListener('click', () => {
      const key = card.dataset.template;
      const tmpl = state.templates[key];
      if (!tmpl) return;

      document.querySelectorAll('.template-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');

      document.getElementById('server-name').value = key;
      document.getElementById('server-type').value = tmpl.type;
      document.getElementById('server-command').value = tmpl.command || '';
      document.getElementById('server-args').value = (tmpl.args || []).join('\n');
      document.getElementById('server-url').value = tmpl.url || '';
      document.getElementById('server-env').value = Object.entries(tmpl.env || {}).map(([k, v]) => `${k}=${v}`).join('\n');

      const isStdio = tmpl.type === 'stdio';
      document.getElementById('stdio-fields').classList.toggle('hidden', !isStdio);
      document.getElementById('sse-fields').classList.toggle('hidden', isStdio);
    });
  });
}

window.saveServer = async function (isEdit) {
  const tool = document.getElementById('server-tool').value;
  const name = document.getElementById('server-name').value.trim();
  const type = document.getElementById('server-type').value;
  const enabled = document.getElementById('server-enabled').checked;

  if (!name) {
    showToast('Server name is required', 'error');
    return;
  }

  const server = { name, type, enabled };

  if (type === 'stdio') {
    server.command = document.getElementById('server-command').value.trim();
    server.args = document.getElementById('server-args').value.split('\n').map(s => s.trim()).filter(Boolean);
  } else {
    server.url = document.getElementById('server-url').value.trim();
  }

  // Parse env vars
  const envText = document.getElementById('server-env').value;
  server.env = {};
  envText.split('\n').forEach(line => {
    const idx = line.indexOf('=');
    if (idx > 0) {
      server.env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
  });

  try {
    await api.addOrUpdateServer(tool, server);
    await loadConfigs();
    closeModal();
    showToast(isEdit ? 'Server updated' : 'Server added', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
};

// ===== Server Actions =====
window.toggleServer = async function (tool, name) {
  try {
    await api.toggleServer(tool, name);
    await loadConfigs();
    showToast('Server toggled', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.deleteServer = async function (tool, name) {
  if (!confirm(`Delete server "${name}"?`)) return;

  try {
    await api.deleteServer(tool, name);
    await loadConfigs();
    showToast('Server deleted', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
};

// ===== Grouped Server Actions =====
window.toggleGroupedServer = async function (name, toolsStr) {
  const tools = toolsStr.split(',');
  try {
    let successCount = 0;
    for (const tool of tools) {
      await api.toggleServer(tool, name);
      successCount++;
    }
    await loadConfigs();
    showToast(`Toggled server on ${successCount} tools`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.deleteGroupedServer = async function (name, toolsStr) {
  const tools = toolsStr.split(',');
  if (!confirm(`Delete server "${name}" from ALL ${tools.length} tools?`)) return;

  try {
    let successCount = 0;
    for (const tool of tools) {
      await api.deleteServer(tool, name);
      successCount++;
    }
    await loadConfigs();
    showToast(`Deleted server from ${successCount} tools`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.copyServerJson = function (tool, name) {
  const servers = state.configs[tool];
  const server = servers?.find(s => s.name === name);
  if (!server) return;

  // Create clean config object
  const config = {};
  const serverConfig = {};

  if (server.type === 'stdio') {
    serverConfig.command = server.command;
    if (server.args && server.args.length) {
      serverConfig.args = server.args;
    }
  } else {
    serverConfig.url = server.url;
  }

  if (server.env && Object.keys(server.env).length) {
    serverConfig.env = server.env;
  }

  if (!server.enabled) {
    serverConfig.disabled = true;
  }

  config[server.name] = serverConfig;

  navigator.clipboard.writeText(JSON.stringify(config, null, 2))
    .then(() => showToast('Server JSON copied to clipboard', 'success'))
    .catch(err => showToast('Failed to copy: ' + err, 'error'));
};

window.openInstallToModal = function (sourceTool, serverName) {
  const servers = state.configs[sourceTool];
  const server = servers?.find(s => s.name === serverName);
  if (!server) return;

  const otherTools = state.tools.filter(t => t.name !== sourceTool);

  openModal(`
    <div class="modal-header">
      <h3>Install "${escapeHtml(serverName)}" to...</h3>
      <button class="modal-close" onclick="window.closeModal()">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
        </svg>
      </button>
    </div>
    <div class="modal-body">
      <p style="margin-bottom: 1rem; color: var(--text-secondary);">
        Select tools to install this server to:
      </p>
      <div class="server-select-list" id="install-tools-list">
        ${otherTools.map(t => `
          <label class="server-select-item">
            <input type="checkbox" value="${t.name}">
            <span class="status-dot ${t.exists ? 'exists' : 'missing'}"></span>
            <span>${t.displayName}</span>
          </label>
        `).join('')}
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="window.closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="window.performInstallTo('${sourceTool}', '${escapeHtml(serverName)}')">
        Install
      </button>
    </div>
  `);
};

window.performInstallTo = async function (sourceTool, serverName) {
  const checkboxes = document.querySelectorAll('#install-tools-list input:checked');
  const targetTools = Array.from(checkboxes).map(cb => cb.value);

  if (targetTools.length === 0) {
    showToast('Select at least one tool', 'warning');
    return;
  }

  try {
    let successCount = 0;
    for (const targetTool of targetTools) {
      // Use sync_configs to copy the single server
      await api.syncConfigs(sourceTool, targetTool, [serverName]);
      successCount++;
    }

    await loadConfigs();
    closeModal();
    showToast(`Installed to ${successCount} tool(s)`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.closeModal = closeModal;

// ===== Sync Modal =====
function openSyncModal() {
  if (state.selectedTool === 'all') {
    showToast('Select a specific tool to sync from', 'warning');
    return;
  }

  const fromServers = state.configs[state.selectedTool] || [];
  if (fromServers.length === 0) {
    showToast('No servers to sync', 'warning');
    return;
  }

  const otherTools = state.tools.filter(t => t.name !== state.selectedTool);

  openModal(`
    <div class="modal-header">
      <h3>Sync Configuration</h3>
      <button class="modal-close" onclick="window.closeModal()">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
        </svg>
      </button>
    </div>
    <div class="modal-body">
      <div class="sync-grid">
        <div>
          <label class="form-label">From</label>
          <input type="text" class="form-input" value="${state.tools.find(t => t.name === state.selectedTool)?.displayName}" disabled>
        </div>
        <div class="sync-arrow">
          <svg width="24" height="24" viewBox="0 0 16 16" fill="currentColor">
            <path fill-rule="evenodd" d="M1 8a.5.5 0 0 1 .5-.5h11.793l-3.147-3.146a.5.5 0 0 1 .708-.708l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 0 1-.708-.708L13.293 8.5H1.5A.5.5 0 0 1 1 8z"/>
          </svg>
        </div>
        <div>
          <label class="form-label">To</label>
          <select class="form-select" id="sync-target">
            ${otherTools.map(t => `<option value="${t.name}">${t.displayName}</option>`).join('')}
          </select>
        </div>
      </div>
      
      <div class="form-group" style="margin-top: 1rem;">
        <label class="form-label">Servers to Sync</label>
        <div class="server-select-list">
          ${fromServers.map(s => `
            <label class="server-select-item">
              <input type="checkbox" name="sync-server" value="${s.name}" checked>
              <span>${s.name}</span>
            </label>
          `).join('')}
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="window.closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="window.performSync()">Sync</button>
    </div>
  `);
}

window.performSync = async function () {
  const to = document.getElementById('sync-target').value;
  const checkboxes = document.querySelectorAll('input[name="sync-server"]:checked');
  const serverNames = Array.from(checkboxes).map(cb => cb.value);

  if (serverNames.length === 0) {
    showToast('Select at least one server', 'warning');
    return;
  }

  try {
    const result = await api.syncConfigs(state.selectedTool, to, serverNames);
    await loadConfigs();
    closeModal();
    showToast(`Synced ${result.synced} server(s)`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
};

// ===== Backup Modal =====
async function openBackupModal() {
  const backups = await api.getBackups();

  // Sort backups by timestamp descending (newest first)
  backups.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  openModal(`
    <div class="modal-header">
      <h3>Backups</h3>
      <button class="modal-close" onclick="window.closeModal()">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
        </svg>
      </button>
    </div>
    <div class="modal-body">
      <button class="btn btn-primary" onclick="window.createBackup()" style="margin-bottom: 1rem; width: 100%;">
        Create New Backup
      </button>
      
      <div class="backup-list">
        ${backups.length === 0 ? '<p style="color: var(--text-muted); text-align: center;">No backups yet</p>' :
      backups.map(b => {
        // Fix date parsing: 2025-12-05T17-15-59 -> 2025-12-05T17:15:59
        const parts = b.timestamp.split('T');
        const dateStr = parts.length === 2
          ? `${parts[0]}T${parts[1].replace(/-/g, ':')}`
          : b.timestamp;
        const displayDate = new Date(dateStr).toLocaleString();

        return `
            <div class="backup-item">
              <div class="backup-info">
                <div class="backup-date">${displayDate}</div>
                <div class="backup-file">${b.name}</div>
              </div>
              <div style="display: flex; gap: 0.5rem;">
                <button class="btn btn-secondary btn-sm" onclick="window.restoreBackup('${b.name}')">Restore</button>
                <button class="btn btn-danger btn-sm" onclick="window.deleteBackup('${b.name}')">Delete</button>
              </div>
            </div>
          `;
      }).join('')
    }
      </div>
    </div>
  `);
}

window.createBackup = async function () {
  try {
    const result = await api.createBackup();
    showToast(`Backup created: ${result.name}`, 'success');
    openBackupModal(); // Refresh list
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.restoreBackup = async function (filename) {
  if (!confirm('Restore from this backup? Current configs will be overwritten.')) return;

  try {
    await api.restoreBackup(filename);
    await loadConfigs();
    closeModal();
    showToast('Backup restored', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.deleteBackup = async function (filename) {
  console.log('Deleting backup:', filename);
  if (!confirm(`Delete backup "${filename}"?`)) return;

  try {
    await api.deleteBackup(filename);
    showToast('Backup deleted', 'success');
    openBackupModal(); // Refresh list
  } catch (err) {
    console.error('Delete failed:', err);
    showToast(err.message, 'error');
  }
};

// ===== Import/Export =====
async function exportConfigs() {
  try {
    const data = await api.exportConfigs();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mcp-configs-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Configs exported', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openImportModal() {
  openModal(`
    <div class="modal-header">
      <h3>Import Configuration</h3>
      <button class="modal-close" onclick="window.closeModal()">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
        </svg>
      </button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">Select File</label>
        <input type="file" class="form-input" id="import-file" accept=".json">
      </div>
      <div class="form-group">
        <label class="toggle">
          <input type="checkbox" class="toggle-input" id="import-merge">
          <span class="toggle-slider"></span>
          <span class="toggle-label">Merge with existing configs (instead of replacing)</span>
        </label>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="window.closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="window.performImport()">Import</button>
    </div>
  `);
}

window.performImport = async function () {
  const fileInput = document.getElementById('import-file');
  const merge = document.getElementById('import-merge').checked;

  if (!fileInput.files.length) {
    showToast('Select a file', 'warning');
    return;
  }

  try {
    const text = await fileInput.files[0].text();
    const data = JSON.parse(text);

    await api.importConfigs(data, merge);
    await loadConfigs();
    closeModal();
    showToast('Configs imported', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
};

// ===== Paste JSON Modal =====
function openPasteJsonModal() {
  const defaultTool = state.selectedTool !== 'all' ? state.selectedTool : state.tools[0]?.name;

  openModal(`
    <div class="modal-header">
      <h3>Paste JSON Configuration</h3>
      <button class="modal-close" onclick="window.closeModal()">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
        </svg>
      </button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">Target Tool</label>
        <select class="form-select" id="paste-tool">
          ${state.tools.map(t => `
            <option value="${t.name}" ${defaultTool === t.name ? 'selected' : ''}>${t.displayName}</option>
          `).join('')}
        </select>
      </div>
      
      <div class="form-group">
        <label class="form-label">Paste MCP Server JSON</label>
        <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 0.5rem;">
          Paste the JSON config snippet. Supports formats like:<br>
          <code>"server-name": { "command": "npx", "args": [...] }</code>
        </p>
        <textarea class="form-textarea" id="paste-json" rows="10" placeholder='"atlassian": {
  "command": "npx",
  "args": ["-y", "mcp-remote", "https://mcp.atlassian.com/v1/sse"]
}'></textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="window.closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="window.performPasteJson()">Add Server(s)</button>
    </div>
  `);
}

window.performPasteJson = async function () {
  const tool = document.getElementById('paste-tool').value;
  let jsonText = document.getElementById('paste-json').value.trim();

  if (!jsonText) {
    showToast('Please paste a JSON configuration', 'warning');
    return;
  }

  try {
    // Try to parse as-is first (full object)
    let servers = {};

    // Wrap in braces if it looks like a key-value pair without outer braces
    if (!jsonText.startsWith('{')) {
      jsonText = '{' + jsonText + '}';
    }

    servers = JSON.parse(jsonText);

    // Process each server in the pasted JSON
    let addedCount = 0;
    for (const [name, config] of Object.entries(servers)) {
      // Determine server type
      const command = config.command || '';
      const serverType = command ? 'stdio' : 'sse';

      const server = {
        name: name,
        type: serverType,
        command: command,
        args: config.args || [],
        env: config.env || {},
        url: config.url || '',
        enabled: config.disabled !== true
      };

      await api.addOrUpdateServer(tool, server);
      addedCount++;
    }

    await loadConfigs();
    closeModal();
    showToast(`Added ${addedCount} server(s) from JSON`, 'success');
  } catch (err) {
    console.error('JSON parse error:', err);
    showToast('Invalid JSON format. Please check your input.', 'error');
  }
};

// ===== Data Loading =====
async function loadTools() {
  try {
    state.tools = await api.getTools();
  } catch (err) {
    showToast('Failed to load tools', 'error');
  }
}

async function loadConfigs() {
  try {
    state.configs = await api.getAllConfigs();
    renderToolTabs();
    renderServerList();
    renderStats();
  } catch (err) {
    showToast('Failed to load configs', 'error');
  }
}

async function loadTemplates() {
  try {
    const res = await fetch('/templates/defaults.json');
    state.templates = await res.json();
  } catch (err) {
    console.warn('Failed to load templates', err);
  }
}

// ===== Settings Modal =====
function openSettingsModal() {
  const toolsList = state.tools.map(tool => `
    <div class="settings-tool-item" data-tool="${tool.name}">
      <div class="settings-tool-header">
        <span class="status-dot ${tool.exists ? 'exists' : 'missing'}"></span>
        <span class="settings-tool-name">${tool.displayName}</span>
        <span class="settings-tool-status ${tool.exists ? 'found' : 'not-found'}">
          ${tool.exists ? '✓ Found' : '✗ Not found'}
        </span>
      </div>
      <div class="settings-tool-path-input">
        <input type="text" class="form-input path-input" 
               data-tool="${tool.name}"
               value="${escapeHtml(tool.configPath)}" 
               placeholder="Config file path"
               ${tool.isCustomPath ? 'data-custom="true"' : ''}>
        ${tool.isCustomPath ? `
          <button class="btn btn-secondary btn-sm reset-path-btn" data-tool="${tool.name}" title="Reset to default">
            ↺
          </button>
        ` : ''}
      </div>
      <div class="settings-tool-key">
        Key: <code>${tool.configKey}</code>
      </div>
    </div>
  `).join('');

  openModal(`
    <div class="modal-header">
      <h3>Settings</h3>
      <button class="modal-close" onclick="window.closeModal()">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
        </svg>
      </button>
    </div>
    <div class="modal-body">
      <div class="settings-section">
        <h4>Config File Paths</h4>
        <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 1rem;">
          Edit paths to point to your config files. Changes are saved automatically.
          <br><span class="status-dot exists" style="display: inline-block; margin: 0 4px;"></span> = found,
          <span class="status-dot missing" style="display: inline-block; margin: 0 4px;"></span> = not found
        </p>
        <div class="settings-tools-list">
          ${toolsList}
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="window.closeModal()">Close</button>
      <button class="btn btn-primary" onclick="window.refreshTools()">Refresh Detection</button>
    </div>
  `);

  // Add event listeners for path inputs
  setupSettingsHandlers();
}

function setupSettingsHandlers() {
  // Debounce timer for auto-save
  let saveTimeout = null;

  document.querySelectorAll('.path-input').forEach(input => {
    input.addEventListener('input', () => {
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(async () => {
        const tool = input.dataset.tool;
        const path = input.value.trim();
        await window.saveToolPath(tool, path);
      }, 500);
    });
  });

  document.querySelectorAll('.reset-path-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const tool = btn.dataset.tool;
      await window.saveToolPath(tool, '');
      await loadTools();
      await loadConfigs();
      openSettingsModal();
      showToast('Path reset to default', 'success');
    });
  });
}

window.saveToolPath = async function (tool, path) {
  try {
    await api.updateToolPath(tool, path);
    await loadTools();
    await loadConfigs();
    // Update the status dot in the modal without reopening
    const toolItem = document.querySelector(`.settings-tool-item[data-tool="${tool}"]`);
    if (toolItem) {
      const toolInfo = state.tools.find(t => t.name === tool);
      if (toolInfo) {
        const statusDot = toolItem.querySelector('.status-dot');
        const statusText = toolItem.querySelector('.settings-tool-status');
        statusDot.className = `status-dot ${toolInfo.exists ? 'exists' : 'missing'}`;
        statusText.className = `settings-tool-status ${toolInfo.exists ? 'found' : 'not-found'}`;
        statusText.textContent = toolInfo.exists ? '✓ Found' : '✗ Not found';
      }
    }
  } catch (err) {
    showToast('Failed to save path: ' + err.message, 'error');
  }
};

window.refreshTools = async function () {
  await loadTools();
  await loadConfigs();
  openSettingsModal();
  showToast('Tool detection refreshed', 'success');
};

// ===== Initialization =====
async function init() {
  // Event listeners
  document.getElementById('btn-backup').addEventListener('click', openBackupModal);
  document.getElementById('btn-import').addEventListener('click', openImportModal);
  document.getElementById('btn-export').addEventListener('click', exportConfigs);
  document.getElementById('btn-sync').addEventListener('click', openSyncModal);
  document.getElementById('btn-paste-json').addEventListener('click', openPasteJsonModal);
  document.getElementById('btn-settings').addEventListener('click', openSettingsModal);
  document.getElementById('btn-add-server').addEventListener('click', window.openAddServerModal);

  // Load data
  await loadTemplates();
  await loadTools();
  await loadConfigs();
}

// Hidden class for toggling
const style = document.createElement('style');
style.textContent = '.hidden { display: none !important; }';
document.head.appendChild(style);

init();

