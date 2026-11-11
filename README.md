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

```sh
git clone https://github.com/Of-qinhai/dsh-team-baton-client.git
cd dsh-team-baton-client
cp cordis.patch.example.yml cordis.patch.yml
```

Edit `cordis.patch.yml`:

```yaml
- insert:
    - id: baton
      name: '@token-team/dsh-baton'
      config:
        serverUrl: wss://baton.example.com/ws
        # secretFile: /absolute/path/to/secret   # defaults to ~/.config/baton/secret
        displayName: Your name
        environments:
          - { key: frontend, label: Frontend, cwd: /absolute/path/to/web }
          - { key: backend,  label: Backend,  cwd: /absolute/path/to/api }
```

Put the team secret at `~/.config/baton/secret` (directory 0700, file 0600), or
set `BATON_SECRET` in the environment:

```sh
mkdir -p ~/.config/baton
printf '%s\n' '<team secret>' > ~/.config/baton/secret
chmod 700 ~/.config/baton
chmod 600 ~/.config/baton/secret
```

Install from this repository root (not the server repository):

```text
plugin_manager install_bundle target=/absolute/path/to/dsh-team-baton-client
```

The install requires approval. Restart DSH and refresh the page afterwards.

`cordis.patch.yml` is Git-ignored; never commit your endpoint, secret, or local
paths. A non-localhost `serverUrl` must use `wss://`; `secretFile` must be
absolute and mode 0600.

## Panel

The sidebar entry sits below Automation Tasks. Clicking it opens the inbox in the
main area: rooms on the left, tasks in the middle, task detail on the right. Only
**Accept and start** creates a Session and submits the brief. Declining only
updates state. A `needs review` task can only be dismissed manually.

The sender chooses an environment key; this install maps it to its own absolute
`cwd`. Remote paths are never sent and there is no fallback directory.

## Agent tools

Only three tools are registered: `team_rooms`, `team_task_send`, and `team_tasks`.
Approval is not exposed to the agent, and remote titles, briefs, and display names
never enter the current Agent context.

## Development

```sh
npm ci
npm test          # 51 unit tests
npm run preview   # http://127.0.0.1:4371, in-memory sample data
```

`npm run test:flow` and `npm run test:integration` additionally need the Rust
server checkout; see the comments in those scripts. Browser regression
(`npm run test:client`) needs `playwright/test` and Chromium installed separately.

## License

[MIT](LICENSE)
