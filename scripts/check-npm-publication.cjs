const { appendFileSync } = require('node:fs');

async function isPublished(name, version, fetcher = fetch) {
  const url = `https://registry.npmjs.org/${encodeURIComponent(name)}/${encodeURIComponent(version)}`;
  const response = await fetcher(url, { signal: AbortSignal.timeout(30000) });
  if (response.status === 404) return false;
  if (!response.ok) throw new Error(`npm registry returned ${response.status}`);
  const metadata = await response.json();
  if (metadata.version !== version) throw new Error('npm registry version mismatch');
  return true;
}

module.exports = { isPublished };

if (require.main === module) {
  const { name, version } = require('../package.json');
  isPublished(name, version)
    .then((exists) => {
      if (!process.env.GITHUB_OUTPUT) throw new Error('GITHUB_OUTPUT is required');
      appendFileSync(process.env.GITHUB_OUTPUT, `exists=${exists}\n`);
      console.log(`${name}@${version}: ${exists ? 'already published' : 'not published'}`);
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
