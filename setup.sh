#!/bin/sh
# Interactive first-run setup for Baton. Writes only local files under
# BATON_HOME (default ~/.dsh/baton) and the default secret file.
set -eu

base="${BATON_HOME:-$HOME/.dsh/baton}"
secret_file="${BATON_SECRET_FILE:-$HOME/.config/baton/secret}"
settings="$base/settings.json"

say() { printf '%s\n' "$*"; }
fail() { printf '错误：%s\n' "$*" >&2; exit 1; }
trim() { printf '%s' "$1" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//'; }

say "Baton 本机配置"
say "配置文件：$settings"
say "密钥文件：$secret_file"
say ""

existing_server=""
if [ -f "$settings" ] && command -v node >/dev/null 2>&1; then
  existing_server=$(node -e 'try { const s = require(process.argv[1]); if (typeof s.serverUrl === "string") process.stdout.write(s.serverUrl) } catch {}' "$settings" 2>/dev/null || true)
fi

printf '显示名称（1-40 个字符）：'
IFS= read -r display_name || fail "读取显示名称失败"
display_name=$(trim "$display_name")
[ -n "$display_name" ] || fail "显示名称不能为空"
[ "$(printf '%s' "$display_name" | wc -m | tr -d ' ')" -le 40 ] || fail "显示名称不能超过 40 个字符"
case "$display_name" in *'"'*|*'\'*) fail "显示名称不能包含双引号或反斜杠" ;; esac

if [ -n "$existing_server" ]; then
  printf '服务地址（留空保留 %s）：' "$existing_server"
else
  printf '服务地址（wss://...，可留空稍后在 profile patch 配置）：'
fi
IFS= read -r server_url || fail "读取服务地址失败"
server_url=$(trim "$server_url")
[ -n "$server_url" ] || server_url="$existing_server"
case "$server_url" in
  "") ;;
  wss://*) ;;
  ws://127.0.0.1:*|ws://localhost:*) ;;
  *) fail "服务地址必须是 wss://，本机调试可用 ws://127.0.0.1:端口或 ws://localhost:端口" ;;
esac
case "$server_url" in *'"'*|*'\'*) fail "服务地址不能包含双引号或反斜杠" ;; esac

have_secret=0
if [ -s "$secret_file" ]; then
  have_secret=1
  printf '团队密钥（留空保留现有密钥）：'
else
  printf '团队密钥（输入不回显，至少 32 字符）：'
fi
trap 'stty echo 2>/dev/null || true' EXIT INT TERM
stty -echo 2>/dev/null || true
IFS= read -r secret || { stty echo 2>/dev/null || true; fail "读取密钥失败"; }
stty echo 2>/dev/null || true
trap - EXIT INT TERM
say ""

if [ -z "$secret" ]; then
  [ "$have_secret" -eq 1 ] || fail "密钥不能为空"
  chmod 600 "$secret_file"
else
  [ "$(printf '%s' "$secret" | wc -m | tr -d ' ')" -ge 32 ] || fail "密钥至少 32 个字符"
  secret_dir=$(dirname "$secret_file")
  mkdir -p "$secret_dir"
  umask 077
  printf '%s\n' "$secret" > "$secret_file"
  chmod 600 "$secret_file"
fi

umask 077
mkdir -p "$base"
chmod 700 "$base"
temporary="$settings.$$.tmp"
if [ -n "$server_url" ]; then
  printf '{"displayName":"%s","serverUrl":"%s"}\n' "$display_name" "$server_url" > "$temporary"
else
  printf '{"displayName":"%s"}\n' "$display_name" > "$temporary"
fi
chmod 600 "$temporary"
mv "$temporary" "$settings"
chmod 600 "$settings"

say "已保存：$settings"
say "密钥已保存：$secret_file"
if [ -z "$server_url" ]; then
  say "注意：没有服务地址，插件暂不会连接；请重新运行并填写，或在 profile patch 里配置。"
fi
say "重启 DSH 或重新加载 Baton 插件后生效。"
