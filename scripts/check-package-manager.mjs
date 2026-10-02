const userAgent = process.env.npm_config_user_agent || '';

if (!userAgent.startsWith('pnpm/9.')) {
  console.error('Use pnpm 9 (packageManager: pnpm@9.0.0). Other versions may ignore the security overrides or rewrite the lockfile.');
  process.exit(1);
}
