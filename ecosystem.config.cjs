module.exports = {
  apps: [{
    name: 'kindred-api',
    script: './artifacts/api-server/dist/index.mjs',
    node_args: '--enable-source-maps',
    env_file: '.env',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
