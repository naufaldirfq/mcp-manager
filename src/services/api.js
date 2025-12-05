import { invoke } from '@tauri-apps/api/core';

// ===== Tools =====
export async function getTools() {
    return await invoke('get_tools');
}

// ===== Configs =====
export async function getAllConfigs() {
    return await invoke('get_all_configs');
}

export async function getConfigsForTool(tool) {
    return await invoke('get_configs', { tool });
}

export async function addOrUpdateServer(tool, server) {
    return await invoke('add_or_update_server', { tool, server });
}

export async function deleteServer(tool, serverName) {
    return await invoke('delete_server', { tool, serverName });
}

export async function toggleServer(tool, serverName) {
    return await invoke('toggle_server', { tool, serverName });
}

export async function syncConfigs(from, to, serverNames = null) {
    return await invoke('sync_configs', { from, to, serverNames });
}

// ===== Backup =====
export async function getBackups() {
    return await invoke('get_backups');
}

export async function createBackup() {
    return await invoke('create_backup');
}

export async function restoreBackup(filename, toolsToRestore = null) {
    return await invoke('restore_backup', { filename, toolsToRestore });
}

export async function deleteBackup(filename) {
    return await invoke('delete_backup', { filename });
}

// ===== Import/Export =====
export async function exportConfigs() {
    return await invoke('export_configs');
}

export async function importConfigs(data, merge = false) {
    return await invoke('import_configs', { tools: data.tools, merge });
}

// ===== Settings =====
export async function updateToolPath(tool, path) {
    return await invoke('update_tool_path', { tool, path });
}

