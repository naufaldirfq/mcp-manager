use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

// ===== Data Models =====

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpServer {
    pub name: String,
    #[serde(rename = "type")]
    pub server_type: String,
    #[serde(default)]
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub env: HashMap<String, String>,
    #[serde(default)]
    pub url: String,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
}

fn default_enabled() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolInfo {
    pub name: String,
    #[serde(rename = "displayName")]
    pub display_name: String,
    #[serde(rename = "configPath")]
    pub config_path: String,
    #[serde(rename = "configKey")]
    pub config_key: String,
    pub exists: bool,
    #[serde(rename = "isCustomPath")]
    pub is_custom_path: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Backup {
    pub name: String,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupData {
    pub timestamp: String,
    pub tools: HashMap<String, Vec<McpServer>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppSettings {
    #[serde(default)]
    pub custom_paths: HashMap<String, String>,
}

// ===== Tool Definitions =====

struct ToolDef {
    name: &'static str,
    display_name: &'static str,
    config_key: &'static str,
    format: &'static str,
    path_fn: fn(&PathBuf) -> PathBuf,
}

fn get_tool_definitions() -> Vec<ToolDef> {
    vec![
        ToolDef {
            name: "claude",
            display_name: "Claude Code",
            config_key: "mcpServers",
            format: "json",
            path_fn: |home| home.join(".claude.json"),
        },
        ToolDef {
            name: "gemini",
            display_name: "Gemini CLI",
            config_key: "mcpServers",
            format: "json",
            path_fn: |home| home.join(".gemini").join("settings.json"),
        },
        ToolDef {
            name: "codex",
            display_name: "Codex CLI",
            config_key: "mcp_servers",
            format: "toml",
            path_fn: |home| home.join(".codex").join("config.toml"),
        },
        ToolDef {
            name: "copilot",
            display_name: "Copilot CLI",
            config_key: "mcpServers",
            format: "json",
            path_fn: |home| home.join(".copilot").join("mcp-config.json"),
        },
        ToolDef {
            name: "vscode",
            display_name: "VS Code",
            config_key: "servers",
            format: "json",
            path_fn: |home| home.join("Library/Application Support/Code/User/mcp.json"),
        },
        ToolDef {
            name: "cursor",
            display_name: "Cursor",
            config_key: "mcpServers",
            format: "json",
            path_fn: |home| home.join("Library/Application Support/Cursor/User/mcp.json"),
        },
        ToolDef {
            name: "vscode-insiders",
            display_name: "VS Code Insiders",
            config_key: "servers",
            format: "json",
            path_fn: |home| home.join("Library/Application Support/Code - Insiders/User/mcp.json"),
        },
        ToolDef {
            name: "windsurf",
            display_name: "Windsurf",
            config_key: "mcpServers",
            format: "json",
            path_fn: |home| home.join(".codeium/windsurf/mcp_config.json"),
        },
    ]
}

// ===== Settings & Config Paths =====

fn get_home_dir() -> PathBuf {
    dirs::home_dir().expect("Could not find home directory")
}

fn get_settings_path() -> PathBuf {
    get_home_dir().join(".mcp-manager").join("settings.json")
}

fn load_settings() -> AppSettings {
    let path = get_settings_path();
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(settings) = serde_json::from_str(&content) {
                return settings;
            }
        }
    }
    AppSettings::default()
}

fn save_settings(settings: &AppSettings) -> Result<(), String> {
    let path = get_settings_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let content = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())
}

fn get_tool_path(tool_name: &str) -> Option<(PathBuf, &'static str, &'static str)> {
    let home = get_home_dir();
    let settings = load_settings();
    let defs = get_tool_definitions();
    
    for def in defs {
        if def.name == tool_name {
            // Check for custom path first
            let path = if let Some(custom_path) = settings.custom_paths.get(tool_name) {
                if !custom_path.is_empty() {
                    // Expand ~ to home directory
                    if custom_path.starts_with("~") {
                        home.join(custom_path.trim_start_matches("~/"))
                    } else {
                        PathBuf::from(custom_path)
                    }
                } else {
                    (def.path_fn)(&home)
                }
            } else {
                (def.path_fn)(&home)
            };
            return Some((path, def.config_key, def.format));
        }
    }
    None
}

fn get_backup_dir() -> PathBuf {
    get_home_dir().join(".mcp-manager").join("backups")
}

// ===== JSON Config Parsing =====

fn read_json_servers(path: &PathBuf, key: &str) -> Vec<McpServer> {
    let content = match fs::read_to_string(path) {
        Ok(c) => c,
        Err(_) => return vec![],
    };
    
    let config: serde_json::Value = match serde_json::from_str(&content) {
        Ok(c) => c,
        Err(_) => return vec![],
    };
    
    let keys_to_try = [key, "mcpServers", "servers"];
    let mut servers_obj = None;
    
    for k in keys_to_try {
        if let Some(s) = config.get(k) {
            if let Some(o) = s.as_object() {
                servers_obj = Some(o.clone());
                break;
            }
        }
    }
    
    let servers_obj = match servers_obj {
        Some(o) => o,
        None => return vec![],
    };
    
    servers_obj.iter().map(|(name, server)| {
        let command = server.get("command").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let server_type = if command.is_empty() { "sse" } else { "stdio" };
        
        McpServer {
            name: name.clone(),
            server_type: server_type.to_string(),
            command,
            args: server.get("args")
                .and_then(|v| v.as_array())
                .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                .unwrap_or_default(),
            env: server.get("env")
                .and_then(|v| v.as_object())
                .map(|obj| obj.iter().filter_map(|(k, v)| v.as_str().map(|s| (k.clone(), s.to_string()))).collect())
                .unwrap_or_default(),
            url: server.get("url").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            enabled: !server.get("disabled").and_then(|v| v.as_bool()).unwrap_or(false),
        }
    }).collect()
}

fn write_json_servers(path: &PathBuf, key: &str, servers: &[McpServer]) -> Result<(), String> {
    let mut config: serde_json::Value = if path.exists() {
        let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).unwrap_or(serde_json::json!({}))
    } else {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        serde_json::json!({})
    };
    
    let mut servers_obj = serde_json::Map::new();
    for server in servers {
        let mut server_config = serde_json::Map::new();
        
        if server.server_type == "stdio" {
            server_config.insert("command".to_string(), serde_json::json!(server.command));
            if !server.args.is_empty() {
                server_config.insert("args".to_string(), serde_json::json!(server.args));
            }
        } else {
            server_config.insert("url".to_string(), serde_json::json!(server.url));
        }
        
        if !server.env.is_empty() {
            server_config.insert("env".to_string(), serde_json::json!(server.env));
        }
        
        if !server.enabled {
            server_config.insert("disabled".to_string(), serde_json::json!(true));
        }
        
        servers_obj.insert(server.name.clone(), serde_json::Value::Object(server_config));
    }
    
    config[key] = serde_json::Value::Object(servers_obj);
    
    let content = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(path, content).map_err(|e| e.to_string())
}

// ===== TOML Config Parsing =====

fn read_toml_servers(path: &PathBuf) -> Vec<McpServer> {
    let content = match fs::read_to_string(path) {
        Ok(c) => c,
        Err(_) => return vec![],
    };
    
    let config: toml::Value = match toml::from_str(&content) {
        Ok(c) => c,
        Err(_) => return vec![],
    };
    
    let servers = match config.get("mcp_servers") {
        Some(s) => s,
        None => return vec![],
    };
    
    let servers_table = match servers.as_table() {
        Some(t) => t,
        None => return vec![],
    };
    
    servers_table.iter().map(|(name, server)| {
        let command = server.get("command").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let server_type = if command.is_empty() { "sse" } else { "stdio" };
        
        McpServer {
            name: name.clone(),
            server_type: server_type.to_string(),
            command,
            args: server.get("args")
                .and_then(|v| v.as_array())
                .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                .unwrap_or_default(),
            env: server.get("env")
                .and_then(|v| v.as_table())
                .map(|t| t.iter().filter_map(|(k, v)| v.as_str().map(|s| (k.clone(), s.to_string()))).collect())
                .unwrap_or_default(),
            url: server.get("url").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            enabled: !server.get("disabled").and_then(|v| v.as_bool()).unwrap_or(false),
        }
    }).collect()
}

fn write_toml_servers(path: &PathBuf, servers: &[McpServer]) -> Result<(), String> {
    let mut config: toml::Value = if path.exists() {
        let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
        toml::from_str(&content).unwrap_or(toml::Value::Table(toml::map::Map::new()))
    } else {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        toml::Value::Table(toml::map::Map::new())
    };
    
    let mut servers_table = toml::map::Map::new();
    for server in servers {
        let mut server_config = toml::map::Map::new();
        
        if server.server_type == "stdio" {
            server_config.insert("command".to_string(), toml::Value::String(server.command.clone()));
            if !server.args.is_empty() {
                server_config.insert("args".to_string(), toml::Value::Array(
                    server.args.iter().map(|s| toml::Value::String(s.clone())).collect()
                ));
            }
        } else {
            server_config.insert("url".to_string(), toml::Value::String(server.url.clone()));
        }
        
        if !server.env.is_empty() {
            let env_table: toml::map::Map<String, toml::Value> = server.env.iter()
                .map(|(k, v)| (k.clone(), toml::Value::String(v.clone())))
                .collect();
            server_config.insert("env".to_string(), toml::Value::Table(env_table));
        }
        
        if !server.enabled {
            server_config.insert("disabled".to_string(), toml::Value::Boolean(true));
        }
        
        servers_table.insert(server.name.clone(), toml::Value::Table(server_config));
    }
    
    if let toml::Value::Table(ref mut t) = config {
        t.insert("mcp_servers".to_string(), toml::Value::Table(servers_table));
    }
    
    let content = toml::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(path, content).map_err(|e| e.to_string())
}

// ===== Config Operations =====

fn read_servers(tool: &str) -> Vec<McpServer> {
    let (path, key, format) = match get_tool_path(tool) {
        Some(p) => p,
        None => return vec![],
    };
    
    match format {
        "toml" => read_toml_servers(&path),
        _ => read_json_servers(&path, key),
    }
}

fn write_servers(tool: &str, servers: &[McpServer]) -> Result<(), String> {
    let (path, key, format) = match get_tool_path(tool) {
        Some(p) => p,
        None => return Err(format!("Unknown tool: {}", tool)),
    };
    
    match format {
        "toml" => write_toml_servers(&path, servers),
        _ => write_json_servers(&path, key, servers),
    }
}

fn get_all_configs_internal() -> HashMap<String, Vec<McpServer>> {
    let mut all = HashMap::new();
    for def in get_tool_definitions() {
        all.insert(def.name.to_string(), read_servers(def.name));
    }
    all
}

// ===== Tauri Commands Module =====
mod commands {
    use super::*;

    #[tauri::command]
    pub fn get_tools() -> Vec<ToolInfo> {
        let home = get_home_dir();
        let settings = load_settings();
        
        get_tool_definitions().iter().map(|def| {
            let default_path = (def.path_fn)(&home);
            let custom_path = settings.custom_paths.get(def.name);
            let is_custom = custom_path.map(|p| !p.is_empty()).unwrap_or(false);
            
            let actual_path = if is_custom {
                let cp = custom_path.unwrap();
                if cp.starts_with("~") {
                    home.join(cp.trim_start_matches("~/"))
                } else {
                    PathBuf::from(cp)
                }
            } else {
                default_path
            };
            
            ToolInfo {
                name: def.name.to_string(),
                display_name: def.display_name.to_string(),
                config_path: actual_path.to_string_lossy().to_string(),
                config_key: def.config_key.to_string(),
                exists: actual_path.exists(),
                is_custom_path: is_custom,
            }
        }).collect()
    }

    #[tauri::command]
    pub fn get_settings() -> AppSettings {
        load_settings()
    }

    #[tauri::command]
    pub fn update_tool_path(tool: String, path: String) -> Result<(), String> {
        let mut settings = load_settings();
        if path.is_empty() {
            settings.custom_paths.remove(&tool);
        } else {
            settings.custom_paths.insert(tool, path);
        }
        save_settings(&settings)
    }

    #[tauri::command]
    pub fn get_all_configs() -> HashMap<String, Vec<McpServer>> {
        get_all_configs_internal()
    }

    #[tauri::command]
    pub fn get_configs(tool: String) -> Vec<McpServer> {
        read_servers(&tool)
    }

    #[tauri::command]
    pub fn add_or_update_server(tool: String, server: McpServer) -> Result<Vec<McpServer>, String> {
        let mut servers = read_servers(&tool);
        
        if let Some(idx) = servers.iter().position(|s| s.name == server.name) {
            servers[idx] = server;
        } else {
            servers.push(server);
        }
        
        write_servers(&tool, &servers)?;
        Ok(servers)
    }

    #[tauri::command]
    pub fn delete_server(tool: String, server_name: String) -> Result<Vec<McpServer>, String> {
        let mut servers = read_servers(&tool);
        servers.retain(|s| s.name != server_name);
        write_servers(&tool, &servers)?;
        Ok(servers)
    }

    #[tauri::command]
    pub fn toggle_server(tool: String, server_name: String) -> Result<McpServer, String> {
        let mut servers = read_servers(&tool);
        
        let server = servers.iter_mut()
            .find(|s| s.name == server_name)
            .ok_or_else(|| format!("Server not found: {}", server_name))?;
        
        server.enabled = !server.enabled;
        let result = server.clone();
        
        write_servers(&tool, &servers)?;
        Ok(result)
    }

    #[tauri::command]
    pub fn sync_configs(from: String, to: String, server_names: Option<Vec<String>>) -> Result<usize, String> {
        let from_servers = read_servers(&from);
        let mut to_servers = read_servers(&to);
        
        let servers_to_sync: Vec<_> = match server_names {
            Some(names) => from_servers.into_iter().filter(|s| names.contains(&s.name)).collect(),
            None => from_servers,
        };
        
        let count = servers_to_sync.len();
        
        for server in servers_to_sync {
            if let Some(idx) = to_servers.iter().position(|s| s.name == server.name) {
                to_servers[idx] = server;
            } else {
                to_servers.push(server);
            }
        }
        
        write_servers(&to, &to_servers)?;
        Ok(count)
    }

    #[tauri::command]
    pub fn get_backups() -> Vec<Backup> {
        let backup_dir = get_backup_dir();
        
        if !backup_dir.exists() {
            return vec![];
        }
        
        fs::read_dir(&backup_dir)
            .ok()
            .map(|entries| {
                entries
                    .filter_map(|e| e.ok())
                    .filter(|e| e.path().extension().map(|ext| ext == "json").unwrap_or(false))
                    .map(|e| {
                        let name = e.file_name().to_string_lossy().to_string();
                        let timestamp = name.replace("backup-", "").replace(".json", "");
                        Backup { name, timestamp }
                    })
                    .collect()
            })
            .unwrap_or_default()
    }

    #[tauri::command]
    pub fn create_backup() -> Result<Backup, String> {
        let backup_dir = get_backup_dir();
        fs::create_dir_all(&backup_dir).map_err(|e| e.to_string())?;
        
        let timestamp = chrono::Local::now().format("%Y-%m-%dT%H-%M-%S").to_string();
        let filename = format!("backup-{}.json", timestamp);
        let path = backup_dir.join(&filename);
        
        let backup_data = BackupData {
            timestamp: timestamp.clone(),
            tools: get_all_configs_internal(),
        };
        
        let content = serde_json::to_string_pretty(&backup_data).map_err(|e| e.to_string())?;
        fs::write(&path, content).map_err(|e| e.to_string())?;
        
        Ok(Backup { name: filename, timestamp })
    }

    #[tauri::command]
    pub fn restore_backup(filename: String, tools_to_restore: Option<Vec<String>>) -> Result<Vec<String>, String> {
        let backup_dir = get_backup_dir();
        let path = backup_dir.join(&filename);
        
        let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        let backup: BackupData = serde_json::from_str(&content).map_err(|e| e.to_string())?;
        
        let mut restored = vec![];
        
        for (tool, servers) in backup.tools {
            if let Some(ref tools) = tools_to_restore {
                if !tools.contains(&tool) {
                    continue;
                }
            }
            
            write_servers(&tool, &servers)?;
            restored.push(tool);
        }
        
        Ok(restored)
    }

    #[tauri::command]
    pub fn delete_backup(filename: String) -> Result<(), String> {
        let backup_dir = get_backup_dir();
        let path = backup_dir.join(&filename);
        fs::remove_file(&path).map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub fn export_configs() -> BackupData {
        BackupData {
            timestamp: chrono::Local::now().format("%Y-%m-%dT%H-%M-%S").to_string(),
            tools: get_all_configs_internal(),
        }
    }

    #[tauri::command]
    pub fn import_configs(tools: HashMap<String, Vec<McpServer>>, merge: bool) -> Result<Vec<String>, String> {
        let mut imported = vec![];
        
        for (tool, servers) in tools {
            let final_servers = if merge {
                let mut existing = read_servers(&tool);
                for server in servers {
                    if let Some(idx) = existing.iter().position(|s| s.name == server.name) {
                        existing[idx] = server;
                    } else {
                        existing.push(server);
                    }
                }
                existing
            } else {
                servers
            };
            
            write_servers(&tool, &final_servers)?;
            imported.push(tool);
        }
        
        Ok(imported)
    }
}

// ===== App Setup =====

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().level(log::LevelFilter::Info).build())
        .invoke_handler(tauri::generate_handler![
            commands::get_tools,
            commands::get_settings,
            commands::update_tool_path,
            commands::get_all_configs,
            commands::get_configs,
            commands::add_or_update_server,
            commands::delete_server,
            commands::toggle_server,
            commands::sync_configs,
            commands::get_backups,
            commands::create_backup,
            commands::restore_backup,
            commands::delete_backup,
            commands::export_configs,
            commands::import_configs,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
