module.exports = {
  apps: [{
    name: 'padelclaw-agent',
    script: 'node_modules/.bin/next',
    args: 'dev -p 3005',
    cwd: '/Users/svc-agent/Projects/dev/padelclaw-agent',
    watch: false,
    autorestart: true,
    max_restarts: 10,
    restart_delay: 2000,
    env: {
      NODE_ENV: 'development'
    },
    log_file: '/tmp/padelclaw-agent.log',
    out_file: '/tmp/padelclaw-agent.log',
    error_file: '/tmp/padelclaw-agent-error.log',
    merge_logs: true
  }]
}
