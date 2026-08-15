module.exports = {
  apps: [
    {
      name: "guildpilot-backend",
      script: "dist/backend/server.js",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
        PORT: 3001
      },
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "logs/backend-error.log",
      out_file: "logs/backend-out.log"
    },
    {
      name: "guildpilot-frontend",
      script: "npm",
      args: "run start:frontend",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
        PORT: 3000
      },
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "logs/frontend-error.log",
      out_file: "logs/frontend-out.log"
    }
  ]
};
