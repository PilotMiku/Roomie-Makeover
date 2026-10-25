/** Only local path prefixes are allowed; never emit a remote runtime dependency. */
export function normalizeBasePath(value: string): string {
  const path = value.trim();
  if (!path || /^\/+$/u.test(path)) return '/';
  const segments = path.split('/').filter(Boolean);
  if (
    segments.some(
      (part) =>
        !/^[\p{L}\p{N}_.-]+$/u.test(part) || part === '.' || part === '..',
    )
  ) {
    throw new Error(
      'VITE_BASE_PATH 必须为本地路径，不能包含 URL、查询参数或相对路径。',
    );
  }
  return `/${segments.join('/')}/`;
}

export function resolveBasePath(
  env: Record<string, string | undefined>,
): string {
  if (env.VITE_BASE_PATH?.trim()) return normalizeBasePath(env.VITE_BASE_PATH);
  if (env.GITHUB_ACTIONS !== 'true') return '/';
  const repository = env.GITHUB_REPOSITORY;
  if (!repository || !/^[\w.-]+\/[\w.-]+$/u.test(repository)) {
    throw new Error('GitHub Actions 构建需要有效的 GITHUB_REPOSITORY。');
  }
  const [owner, name] = repository.split('/');
  return name?.toLowerCase() === `${owner}.github.io`.toLowerCase()
    ? '/'
    : normalizeBasePath(name ?? '');
}
