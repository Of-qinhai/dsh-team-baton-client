# Baton DSH plugin

English | [中文](README.zh-CN.md)

The DSH side of Baton: receive a teammate's task, approve it, and start a Session
in a directory you configured. The relay server lives in a separate repository:
[dsh-team-baton](https://github.com/Of-qinhai/dsh-team-baton).

Public source does not connect to any server by default. You deploy the server
yourself, or get your team's endpoint and shared secret from its administrator.

## Requirements

- DSH Desktop. Verified on Electron 44 / Node 24; other versions may change the
  `sessionController` / `workspaceRegistry` / `uiWorkspace` interfaces used here.
- A running `baton-server`, or your team's endpoint and secret.
- Node 22+ only for the development tests and preview; the installed plugin uses
  DSH's own React and needs no build.

## Install

The package ships a **safe placeholder** `cordis.patch.yml` (empty `serverUrl`),
so the bundle can be installed before it is configured. Configure it through your
DSH profile after installation.

### 1. Put the team secret in place

```sh
mkdir -p ~/.config/baton
printf '%s\n' '<team secret>' > ~/.config/baton/secret
chmod 700 ~/.config/baton
chmod 600 ~/.config/baton/secret
```

`secretFile` defaults to this path; `BATON_SECRET` in the environment takes
precedence when non-empty.

### 2. Install the plugin

Paste the repository URL into the plugin manager's Git repository field (the
dialog that shows **Git 仓库**), or clone and install the local directory:

```sh
git clone https://github.com/Of-qinhai/dsh-team-baton-client.git
# then, in DSH:
plugin_manager install_bundle target=/absolute/path/to/dsh-team-baton-client
```

The install requires approval.

### 3. Configure in the profile patch

Open the profile's `cordis.patch.yml`:

- macOS/Linux: `~/.dsh/profiles/<profile>/cordis.patch.yml`
- Windows: `%USERPROFILE%\.dsh\profiles\<profile>\cordis.patch.yml`

Add a **complete override row** (the same id replaces the whole config, so keep
`serverUrl`):

```yaml
- id: baton
  name: '@ohmynpm/dsh-baton'
  config:
    serverUrl: wss://baton.example.com/ws
    # secretFile: /absolute/path/to/secret   # defaults to ~/.config/baton/secret
    displayName: Your name
    environments:
      - { key: frontend, label: Frontend, cwd: /absolute/path/to/web }
      - { key: backend,  label: Backend,  cwd: /absolute/path/to/api }
```

Do not edit the copy under `node_modules`; it is replaced on reinstall.

### 4. Restart and refresh

Restart DSH, then refresh the page. The sidebar entry sits below Automation Tasks.

A non-localhost `serverUrl` must use `wss://`; `secretFile` must be absolute and
mode 0600. Never commit your endpoint, secret, or local paths.

## Quick setup

After installing (or before installing, `npx` can fetch the package), run the
interactive setup:

```sh
npx --package @ohmynpm/dsh-baton baton-setup
```

It prompts for the display name, the server URL (optional; empty keeps the
current profile config), and the team secret (hidden input). It writes:

- `~/.dsh/baton/settings.json` (0600) with `displayName` and `serverUrl`;
- `~/.config/baton/secret` (0600) with the team secret.

`settings.json` overrides the same values from the profile patch; environments
are still configured in the panel. Restart DSH or reload the plugin afterwards.

## Environments

Each install configures its own directories visually: the folder button in the
panel header opens **本机执行环境**. Add a key, a display label, and an absolute
local directory per environment. The list is saved to
`~/.dsh/baton/environments.json` (0600).

Only the key and label are advertised to room members; absolute paths never leave
the machine. A sender therefore picks an environment from the recipient's own
advertised list, and the recipient still resolves it to its own directory. The
`environments` block in the profile config is only the initial seed for a fresh
install; once the visual editor saves, the local file is authoritative.

## Panel

The sidebar entry sits below Automation Tasks. Clicking it opens the inbox in the
main area: rooms on the left, tasks in the middle, task detail on the right. Only
**Accept and start** creates a Session and submits the brief. Declining only
updates state. A `needs review` task can only be dismissed manually.

The sender chooses an environment key; this install maps it to its own absolute
`cwd`. Remote paths are never sent and there is no fallback directory.

## Task visibility and layout

Both inbox and sent items support **Delete** (move to the deleted-items tab),
restore, and a separately confirmed permanent deletion. One participant's action
does not remove the other participant's copy. After both permanently delete,
the relay removes the live task/brief and retains only its ID and original expiry
to prevent retry resurrection. The existing seven-day expiry remains in effect;
older backups expire on their normal retention schedule. DSH sessions and messages
are never deleted or resubmitted by any of these actions.

The left navigation can collapse, and all three lists scroll within their pane,
including short desktop windows and narrow screens. Directory configuration is
validated and persisted locally, with only keys/labels advertised to room peers.
Offline saves sync on reconnect; publication failures explicitly say that the
local save succeeded but peers have not yet received the change.

## Agent tools

Only three tools are registered: `team_rooms`, `team_task_send`, and `team_tasks`.
Approval is not exposed to the agent, and remote titles, briefs, and display names
never enter the current Agent context.

## Updates

The package version is bumped for every release. Automatic update checks only
work when the plugin is installed from an npm registry package:

- **npm install**: the plugin manager can compare the installed version with the
  registry and offer an update.
- **Git URL or local directory**: there is no default registry source, so the
  plugin manager shows "unable to check for updates"; reinstall the latest
  commit or release tarball instead.

This package is currently `private: true`, so it is not published to npm and a
Git/local install cannot auto-check. Publishing requires setting `private` to
`false`, choosing a reachable package name/registry, and bumping the version for
each release.

## Development

```sh
npm ci
npm test          # Host, connection, checkpoint and local setup regressions
npm run preview   # http://127.0.0.1:4371, in-memory sample data
```

`npm run test:flow` and `npm run test:integration` additionally need the Rust
server checkout; see the comments in those scripts. Browser regression
(`npm run test:client`) needs `playwright/test` and Chromium installed separately.
`npm run test:tasks` additionally covers directory configuration, independent
deletion/restoration, navigation collapse and 160-task scrolling at desktop and
mobile sizes, using fixture data and the actual embedded React client.

## License

[MIT](LICENSE)
