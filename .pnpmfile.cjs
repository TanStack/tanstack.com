const workflowPackageVersions = {
  '@tanstack/workflow-core': '0.0.3',
  '@tanstack/workflow-runtime': '0.0.1',
}

function readPackage(pkg) {
  if (
    pkg.name === '@tanstack/workflow-runtime' ||
    pkg.name === '@tanstack/workflow-store-drizzle-postgres' ||
    pkg.name === '@tanstack/workflow-netlify'
  ) {
    pkg.dependencies = {
      ...pkg.dependencies,
      ...Object.fromEntries(
        Object.entries(workflowPackageVersions).filter(([name]) =>
          pkg.dependencies?.[name]?.startsWith('workspace:'),
        ),
      ),
    }
  }

  return pkg
}

module.exports = {
  hooks: {
    readPackage,
  },
}
